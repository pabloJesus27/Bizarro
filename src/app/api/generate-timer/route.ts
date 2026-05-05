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
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mix', 'none'] },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  seconds: { type: 'number' },
                  intervalSeconds: { type: 'number' },
                  countUp: { type: 'boolean' },
                },
                required: ['label', 'seconds'],
              },
            },
          },
          required: ['type'],
        },
      },
    },
    system: [
      {
        type: 'text',
        text: `Analiza WODs de CrossFit y devuelve SOLO un objeto JSON (sin markdown) con la configuración del temporizador.

Tipos de timer disponibles:
- mix: { "type": "mix", "blocks": [{ "label": "nombre del bloque", "seconds": N, "intervalSeconds"?: N, "countUp"?: true }, ...] }

Reglas:
- For Time CON time cap X min → mix: [{"label":"For Time","seconds":X*60,"countUp":true}]
- For Time SIN time cap → mix: [{"label":"For Time","seconds":0,"countUp":true}] (sin límite, el atleta para manualmente)
- AMRAP N min → mix: [{"label":"AMRAP","seconds":N*60}]
- EMOM N min → mix: [{"label":"EMOM","seconds":N*60,"intervalSeconds":60}] (E2MOM → intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → mix: (Y/X) bloques de X*60s con label descriptivo
- WOD de solo carrera (run, row, carrera, metros, km, distancia) sin otros ejercicios → For Time simple SIEMPRE: 1 solo bloque countUp:true, seconds:0. Aunque haya series, descansos o distancias variables.
- WOD de tipo Core con TODOS los ejercicios por tiempo (ej: "30'' plank / 20'' hollow hold / 30'' dead bug") → mix con bloques alternos de trabajo y descanso según los tiempos indicados.
- WOD de tipo Core con ejercicios a reps (ej: "20 hollow rocks, 15 v-ups") O mixto (algunos por tiempo, otros por reps) → devuelve exactamente: {"type":"none"}
- For Time cuyos bloques NO tienen duración fija en segundos (solo reps, RPE, peso o distancia) → For Time simple SIEMPRE, aunque haya secciones A/B/C o descansos entre ellas. 1 solo bloque countUp:true, seconds:0. NUNCA crear bloques por sección ni bloques de descanso.
- WOD COMPLEJO con fases que SÍ tienen duración fija en segundos (AMRAP N min + descanso + AMRAP N min, X'' on X'' off, EMOM dentro de un mix, etc.) → mix: bloques separados con label descriptivo
- "X sets / X rondas / X rounds" SIN descanso explícito entre sets → For Time simple (1 solo bloque), NO crear un bloque por set
- "X sets" CON descanso explícito Y CON tiempo de trabajo definido por set → mix con bloques alternos trabajo+descanso expandidos
- "X sets" CON descanso explícito PERO SIN tiempo de trabajo definido (el atleta va a su ritmo, no hay cap) → For Time simple (1 solo bloque countUp:true, seconds:0). El atleta ve el crono corriendo y gestiona el descanso mentalmente. NO crear bloques individuales por set ni bloques de descanso. IMPORTANTE: que el DESCANSO tenga duración en segundos (ej: "rest 15''", "rest 3'") NO significa que el trabajo tenga duración fija. Si el trabajo son solo reps (ej: "2 deadlifts", "5 pull ups"), es For Time simple.

Ejemplos de WODs complejos → mix:
- "AMRAP 5 min, descanso 3 min, AMRAP 5 min" → blocks: [AMRAP 1(300s), Descanso(180s), AMRAP 2(300s)]
- "30 seg trabajo / 30 seg descanso x 8 rondas" → 16 blocks alternando Trabajo(30s) y Descanso(30s)
- "EMOM 10 min: min impar X, min par Y" → 10 blocks alternando (60s cada uno)
- "Cada 3 min x 5 series: …" → 5 blocks de 180s con label descriptivo
- "Durante 20 min, cada 2'30'': ejercicio A + ejercicio B, resto del tiempo ejercicio C" → (20*60)/(2*60+30) = 8 bloques de 150s con label que combine los ejercicios (ej: "BikeErg + Sandbag")
- "Durante X min, cada Y min: …" → (X*60 / Y*60) bloques de Y*60s con label descriptivo
- "3 sets, 30" on 30" off, DU / Thrusters / Burpees, rest 90" entre sets" → 17 bloques: [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s),Desc(90s)] × 2 + [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s)]
- "3 sets 30'' on 30'' off: handstand / pull over / hollow rocks / double unders" → cada ejercicio ocupa su propio bloque de 30s trabajo + 30s descanso, rotando en orden, repetido 3 veces → 24 bloques: [Handstand(30s),Off(30s),Pull Over(30s),Off(30s),Hollow Rocks(30s),Off(30s),Double Unders(30s),Off(30s)] × 3
- "30'' on 30'' off: ejercicio A / ejercicio B / ejercicio C" SIN sets especificados → asumir 1 ronda → N*2 bloques alternando trabajo(30s) y descanso(30s) por ejercicio
- "10 sets: 7 TTB + 7 burpees, rest 1 min" (sin tiempo de trabajo definido) → For Time simple: [{"label":"For Time","seconds":0,"countUp":true}]. NO crear 20 bloques sets+descanso.
- "4 x 2.2.2.2, 15'' rest entre series, 3' rest entre bloques" (trabajo = reps, sin tiempo fijo de trabajo) → For Time simple: [{"label":"For Time","seconds":0,"countUp":true}]. Los descansos con tiempo NO convierten el WOD en mix si el trabajo no tiene duración fija.
- "3 sets: 20 wall ball + 10 chest to bar / rest 3 min / 2 sets: 30 wall ball + 20 pull up / rest 3 min / 1 set: max wall ball + max chest to bar" (múltiples grupos con distintos sets/reps y descansos entre grupos, trabajo = reps sin duración fija) → For Time simple: [{"label":"For Time","seconds":0,"countUp":true}]. Aunque los grupos sean distintos y haya descansos, si TODO el trabajo son reps sin tiempo fijo → 1 solo bloque For Time.
- "100 toes to bar, cada parada 10 burpees" / "X reps de A, cada vez que paras Y reps de B" (penalty reps o paradas) → For Time simple: [{"label":"For Time","seconds":0,"countUp":true}]. Las paradas son gestión del atleta, no bloques con duración fija. NUNCA crear bloques por ejercicio.

Reglas para mix:
- El label de cada bloque debe ser corto y descriptivo de lo que ocurre en ese bloque
- Para patrones "cada X min/seg durante Y min", crea exactamente (Y*60 / intervalo) bloques iguales
- seconds debe ser exacto según la descripción. NUNCA uses seconds: 0 EXCEPTO en For Time sin cap (countUp:true, seconds:0)
- En notación CrossFit: X" = X segundos, X' = X minutos. Ej: 30" = 30 segundos, 90" = 90 segundos
- Los bloques de descanso (off, rest) SIEMPRE deben tener su duración en segundos correcta
- Si el WOD dice "X on / X off", crea bloques alternos de trabajo(X seg) y descanso(X seg)
- Si el WOD dice "rest Y" al final de cada set CON tiempo de trabajo definido, añade un bloque de descanso con seconds = Y
- Si el WOD dice "rest Y" al final de cada set SIN tiempo de trabajo definido, NO crees bloques: usa For Time simple (countUp:true, seconds:0)

Solo JSON, sin explicación ni markdown.`,
        cache_control: { type: 'ephemeral' },
      },
    ] as Anthropic.TextBlockParam[],
    messages: [{
      role: 'user',
      content: `WOD:
Título: ${title}
Tipo: ${type}
Descripción: ${description}`,
    }],
  })

  const cfg = JSON.parse((msg.content[0] as { type: 'text'; text: string }).text)

  if (cfg.type === 'none') {
    return NextResponse.json({ type: 'none' })
  }

  if (cfg.type !== 'mix' || !Array.isArray(cfg.blocks) || cfg.blocks.length === 0) {
    return NextResponse.json({ error: 'invalid_timer' }, { status: 500 })
  }

  // Si algún bloque tiene seconds:0 sin countUp, Claude generó bloques sin duración fija
  // → colapsar todo en un For Time simple
  const hasInvalidBlock = cfg.blocks.some(
    (b: { label: string; seconds: number; countUp?: boolean }) =>
      !b.label || (!(b.seconds > 0) && !b.countUp)
  )
  if (hasInvalidBlock) {
    return NextResponse.json({ type: 'mix', blocks: [{ label: 'For Time', seconds: 0, countUp: true }] })
  }

  return NextResponse.json(cfg)
}
