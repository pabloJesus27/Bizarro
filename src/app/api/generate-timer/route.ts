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
- amrap: { "type": "amrap", "totalSeconds": N }
- emom: NO usar — usar mix con 1 bloque [{"label":"EMOM","seconds":N}]
- fortime: { "type": "fortime", "capSeconds": N }  (capSeconds=0 si no hay time cap explícito)
- tabata: { "type": "tabata", "workSeconds": N, "restSeconds": N, "rounds": N }
- mix: { "type": "mix", "blocks": [{ "label": "nombre del bloque", "seconds": N }, ...] }

Reglas de selección:
- EMOM → siempre mix con 1 bloque total (ej: EMOM 10 min → [{"label":"EMOM","seconds":600}])
- For Max con ventanas de X min durante Y min → mix con (Y/X) bloques de X*60s
- AMRAP simple → mix con 1 bloque
- WOD COMPLEJO (AMRAP+descanso+AMRAP, X on X off, etc.) → mix con todos los bloques detallados

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

    const validTypes = ['amrap', 'emom', 'fortime', 'tabata', 'mix']
    if (!cfg || !validTypes.includes(cfg.type)) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }
    if (cfg.type === 'emom' && !(cfg.totalSeconds > 0 && cfg.intervalSeconds > 0)) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }
    if (cfg.type === 'amrap' && !(cfg.totalSeconds > 0)) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }
    if (cfg.type === 'fortime' && typeof cfg.capSeconds !== 'number') {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }
    if (cfg.type === 'tabata' && !(cfg.workSeconds > 0 && cfg.restSeconds > 0 && cfg.rounds > 0)) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }
    if (cfg.type === 'mix' && (!Array.isArray(cfg.blocks) || cfg.blocks.length === 0 || cfg.blocks.some((b: { label: string; seconds: number }) => !b.label || !(b.seconds > 0)))) {
      return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
    }

    return NextResponse.json(cfg)
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }
}
