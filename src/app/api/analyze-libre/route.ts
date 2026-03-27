import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMER_FORMAT = `Tipos de timer disponibles:
- amrap: { "type": "amrap", "totalSeconds": N }
- emom: { "type": "emom", "totalSeconds": N, "intervalSeconds": N }
- fortime: { "type": "fortime", "capSeconds": N }  (capSeconds=0 si no hay time cap)
- tabata: { "type": "tabata", "workSeconds": N, "restSeconds": N, "rounds": N }
- mix: { "type": "mix", "blocks": [{ "label": "...", "seconds": N }, ...] }

Para For Max con "ventanas de X min", "cada X min" o estructura de intervalos: usa emom con intervalSeconds=X*60 y totalSeconds=Y*60. Si es simplemente "max reps/cal en X min" sin intervalos: usa amrap.
Usa null si el bloque es Warmup, Strength, Gymnastics, Core o Mobility sin timer claro.`

const WOD_FIELDS = `Para cada bloque:
- date: fecha en formato YYYY-MM-DD
- block: número de bloque (1=Warm Up, 2=Bloque #1, 3=Bloque #2, etc.)
- title: nombre corto del ejercicio principal (máx 4 palabras)
- type: "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo del bloque tal como aparece`

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const allowed = await checkAiRateLimit(user.id, 'analyze-libre', 5)
  if (!allowed) return NextResponse.json(
    { error: 'Límite diario alcanzado. Inténtalo mañana.' },
    { status: 429 }
  )

  const { imageBase64, mediaType, mode, date, weekDates } = await req.json()

  let promptText: string

  if (mode === 'week') {
    const [lunes, martes, miercoles, jueves, viernes, sabado] = weekDates
    promptText = `Analiza esta imagen con la programación semanal de CrossFit y extrae todos los WODs.

Las fechas de esta semana son:
- LUNES = ${lunes}
- MARTES = ${martes}
- MIÉRCOLES = ${miercoles}
- JUEVES = ${jueves}
- VIERNES = ${viernes}
- SÁBADO = ${sabado}

${WOD_FIELDS}

Reglas de tipo:
- Warm Up → "Warmup"
- Sets/reps con barra o pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Ejercicios de core → "Core"
- Estiramientos, movilidad → "Mobility"
- AMRAP → "AMRAP", For time → "For Time", EMOM → "EMOM", Max cal/reps → "For Max", resto → "Other"

Ignora celdas vacías, filas de separación (DESCANSO, etc), notas de hidratación, nutrición y recordatorios que no sean ejercicios.
Devuelve SOLO un array JSON sin markdown:
[{"date":"...","block":1,"title":"...","type":"...","description":"..."}]`

  } else if (mode === 'day') {
    promptText = `Analiza esta imagen con el entrenamiento del día y extrae todos los bloques.

La fecha es: ${date}

${WOD_FIELDS}
- timerConfig: configuración del timer según las reglas de abajo, o null si no aplica

${TIMER_FORMAT}

Reglas de tipo (usa EXACTAMENTE estos valores):
- Warm Up → "Warmup"
- Sets/reps con barra o pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Ejercicios de core → "Core"
- Estiramientos, movilidad → "Mobility"
- AMRAP → "AMRAP", For time → "For Time", EMOM → "EMOM", Max cal/reps → "For Max", resto → "Other"
Para Warmup, Strength, Gymnastics, Core, Mobility: timerConfig = null salvo que haya un timer explícito.
Ignora notas de hidratación, nutrición, recordatorios o cualquier cosa que no sea un bloque de ejercicio.

Devuelve SOLO un array JSON sin markdown:
[{"date":"${date}","block":1,"title":"...","type":"...","description":"...","timerConfig":...}]`

  } else {
    promptText = `Analiza esta imagen con un WOD de CrossFit y extrae el bloque principal.

La fecha es: ${date}

${WOD_FIELDS}
- timerConfig: configuración del timer según las reglas de abajo, o null si no aplica

${TIMER_FORMAT}

Reglas de tipo (usa EXACTAMENTE estos valores):
- Warm Up → "Warmup"
- Sets/reps con barra o pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Ejercicios de core → "Core"
- Estiramientos, movilidad → "Mobility"
- AMRAP → "AMRAP", For time → "For Time", EMOM → "EMOM", Max cal/reps → "For Max", resto → "Other"
Si hay varios bloques visibles, extrae solo el bloque principal (el WOD metabólico o de mayor intensidad).
Ignora notas de hidratación, nutrición, recordatorios o cualquier cosa que no sea un bloque de ejercicio.

Devuelve SOLO un array JSON con un único elemento, sin markdown:
[{"date":"${date}","block":1,"title":"...","type":"...","description":"...","timerConfig":...}]`
  }

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: promptText },
      ],
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const VALID_TYPES = new Set(['For Time','AMRAP','EMOM','Strength','Gymnastics','Core','Mobility','Warmup','For Max','Other'])

  try {
    const wods = JSON.parse(cleaned)
    const normalized = wods.map((w: Record<string, unknown>) => ({
      ...w,
      type: VALID_TYPES.has(w.type as string) ? w.type : 'Other',
    }))
    return NextResponse.json({ wods: normalized })
  } catch {
    return NextResponse.json({ error: 'Error al interpretar la imagen' }, { status: 500 })
  }
}
