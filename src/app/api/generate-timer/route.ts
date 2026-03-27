import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const allowed = await checkAiRateLimit(user.id, 'generate-timer', 20)
  if (!allowed) return NextResponse.json(
    { error: 'Límite diario alcanzado. Inténtalo mañana.' },
    { status: 429 }
  )

  const { title, description, type } = await req.json()

  if ((title?.length ?? 0) > 200 || (description?.length ?? 0) > 2000) {
    return NextResponse.json({ error: 'Input demasiado largo' }, { status: 400 })
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analiza este WOD de CrossFit y devuelve SOLO un objeto JSON (sin markdown) con la configuración del temporizador.

WOD:
Título: ${title}
Tipo: ${type}
Descripción: ${description}

Tipos de timer disponibles:
- mix: { "type": "mix", "blocks": [{ "label": "nombre del bloque", "seconds": N, "intervalSeconds"?: N, "countUp"?: true }, ...] }

Reglas:
- For Time CON time cap X min → mix: [{"label":"For Time","seconds":X*60,"countUp":true}]
- For Time SIN time cap → mix: [{"label":"For Time","seconds":0,"countUp":true}] (sin límite, el atleta para manualmente)
- AMRAP N min → mix: [{"label":"AMRAP","seconds":N*60}]
- EMOM N min → mix: [{"label":"EMOM","seconds":N*60,"intervalSeconds":60}] (E2MOM → intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → mix: (Y/X) bloques de X*60s con label descriptivo
- WOD COMPLEJO con fases distintas y descanso explícito entre ellas (AMRAP+descanso+AMRAP, X on X off, etc.) → mix: bloques separados con label descriptivo
- "X sets / X rondas / X rounds" SIN descanso explícito entre sets → For Time simple (1 solo bloque), NO crear un bloque por set

Ejemplos de WODs complejos → mix:
- "AMRAP 5 min, descanso 3 min, AMRAP 5 min" → blocks: [AMRAP 1(300s), Descanso(180s), AMRAP 2(300s)]
- "30 seg trabajo / 30 seg descanso x 8 rondas" → 16 blocks alternando Trabajo(30s) y Descanso(30s)
- "EMOM 10 min: min impar X, min par Y" → 10 blocks alternando (60s cada uno)
- "Cada 3 min x 5 series: …" → 5 blocks de 180s con label descriptivo
- "Durante 20 min, cada 2'30'': ejercicio A + ejercicio B, resto del tiempo ejercicio C" → (20*60)/(2*60+30) = 8 bloques de 150s con label que combine los ejercicios (ej: "BikeErg + Sandbag")
- "Durante X min, cada Y min: …" → (X*60 / Y*60) bloques de Y*60s con label descriptivo

Reglas para mix:
- El label de cada bloque debe ser corto y descriptivo de lo que ocurre en ese bloque
- Para patrones "cada X min/seg durante Y min", crea exactamente (Y*60 / intervalo) bloques iguales
- seconds debe ser exacto según la descripción. NUNCA uses seconds: 0
- En notación CrossFit: X" = X segundos, X' = X minutos. Ej: 30" = 30 segundos, 90" = 90 segundos
- Los bloques de descanso (off, rest) SIEMPRE deben tener su duración en segundos correcta
- Si el WOD dice "X on / X off", crea bloques alternos de trabajo(X seg) y descanso(X seg)
- Si el WOD dice "rest Y" al final de cada set, añade un bloque de descanso con seconds = Y

Solo JSON, sin explicación ni markdown.`,
    }],
  })

  const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    const cfg = JSON.parse(clean)

    if (cfg?.type !== 'mix' || !Array.isArray(cfg.blocks) || cfg.blocks.length === 0 || cfg.blocks.some((b: { label: string; seconds: number; countUp?: boolean }) => !b.label || (!(b.seconds > 0) && !b.countUp))) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }

    return NextResponse.json(cfg)
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }
}
