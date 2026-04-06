import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_TYPES = new Set(['For Time','AMRAP','EMOM','Strength','Gymnastics','Core','Mobility','Warmup','For Max','Other'])

async function reviewTypes(wods: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const list = wods.map((w, i) =>
    `${i}. tipo_actual="${w.type}" | título="${w.title}" | descripción="${w.description}"`
  ).join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Revisa los tipos de estos bloques de CrossFit y corrígelos si son incorrectos.

Tipos válidos: Warmup | Strength | Gymnastics | Core | Mobility | For Time | AMRAP | EMOM | For Max | Other

Reglas (aplica en orden, la primera que encaje gana):
1. Contiene AMRAP → AMRAP
2. Contiene EMOM o E2MOM → EMOM
3. Contiene "max cal", "max reps", "max [ejercicio]", formato X" on X" off → For Max
4. Contiene "for time" explícito, o time cap en minutos, o lista de rondas con ejercicios metabólicos SIN sets×reps (burpees, wall balls, sandbag, toes to bar, assault bike como único ejercicio) → For Time
5. Carrera de distancia fija única (ej: "6000m carrera", "800m run") sin sets ni rondas → For Time
6. tipo_actual="Warmup" y NO contiene formato de tiempo explícito (AMRAP/EMOM/for time/min) → mantener Warmup
7. Calentamiento, activación, warm up, movilización dinámica → Warmup
7b. N sets de múltiples ejercicios variados (press, squat, saltos, flexiones, rowing, air squat, pajaros, v-ups, sit-up, knees to chest, buenos dias) sin formato de tiempo explícito → Warmup
8. Ejercicios de fuerza con sets/reps: barra, halterofilia, powerlifting, press, squat, deadlift, clean, snatch, jerk, bench press, gorilla row, lateral raises, curl biceps, triceps, mancuernas, kettlebell (cuando es sets×reps sin formato de tiempo) → Strength
9. Handstand, muscle up, ring dips, dominadas técnicas, gymnastics → Gymnastics
10. Core, abdominales, plancha, GHD, hollow body → Core
11. Movilidad, estiramientos, foam roller, recuperación activa, trote suave → Mobility
12. Técnica de carrera, progresivos de carrera, drills atléticos → Other
13. Resto → Other

Bloques:
${list}

Devuelve SOLO un array JSON con los índices y tipos corregidos, sin markdown:
[{"i":0,"type":"..."},{"i":1,"type":"..."},...]`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  const jsonStart = raw.indexOf('[')
  const jsonEnd = raw.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1) return wods

  try {
    const corrections: { i: number; type: string }[] = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return wods.map((w, i) => {
      const fix = corrections.find(c => c.i === i)
      return fix && VALID_TYPES.has(fix.type) ? { ...w, type: fix.type } : w
    })
  } catch {
    return wods
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const allowed = await checkAiRateLimit(user.id, 'analyze-week', 5)
  if (!allowed) return NextResponse.json(
    { error: 'Límite diario alcanzado. Inténtalo mañana.' },
    { status: 429 }
  )

  const { imageBase64, mediaType, weekDates } = await req.json()

  const [lunes, martes, miercoles, jueves, viernes, sabado] = weekDates

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        {
          type: 'text',
          text: `Analiza esta imagen con la programación semanal de CrossFit y extrae todos los WODs.

Las fechas de esta semana son:
- LUNES = ${lunes}
- MARTES = ${martes}
- MIÉRCOLES = ${miercoles}
- JUEVES = ${jueves}
- VIERNES = ${viernes}
- SÁBADO = ${sabado}

ESTRUCTURA DE LA TABLA:
- Cada COLUMNA es un día. Usa los encabezados (LUNES, MARTES…) para identificar qué columna corresponde a qué día.
- Cada FILA de la tabla es un bloque de entrenamiento. Hay filas ARRIBA y filas ABAJO del separador "DESCANSO / HIDRATACION".
- El separador "DESCANSO" NO es un bloque — ignóralo. Pero las filas que van DESPUÉS del separador SÍ son bloques reales y debes extraerlos igual que los de arriba.
- Algunos días pueden tener 6 bloques (3 antes + 3 después del separador), otros 5, otros 2. Extrae todo el contenido que veas en cada celda, sin omitir filas.

PROCESO (sigue este orden):
1. Identifica cuántas filas tiene la tabla (sin contar el separador DESCANSO).
2. Para cada fila, lee el contenido celda a celda de izquierda a derecha (LUNES → SÁBADO).
3. Si una celda tiene contenido, genera un bloque. Si está vacía, no generes nada.
4. Numera los bloques de cada día de forma independiente empezando en 1.

Para cada bloque devuelve:
- date: fecha YYYY-MM-DD del día correspondiente
- block: número de bloque (1, 2, 3… por día)
- title: nombre corto del ejercicio principal (máx 4 palabras). Fuerza/halterofilia: solo el ejercicio (ej: "Back Squat"). WOD metabólico: ejercicios separados por '+' (ej: "Assault Bike + Burpees").
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo exacto del bloque tal como aparece en la imagen

Reglas para el tipo:
- Warm Up / calentamiento / activación / N sets de ejercicios variados sin tiempo → "Warmup"
- Sets/reps con barra, halterofilia, pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Core, abdominales, plancha, GHD → "Core"
- Estiramientos, movilidad, foam roller → "Mobility"
- AMRAP → "AMRAP"
- For time / tiempo límite / circuito metabólico → "For Time"
- EMOM / E2MOM → "EMOM"
- Max cal / max reps / X" on X" off → "For Max"
- Resto → "Other"

ANTES del JSON, escribe el conteo de bloques por día para verificar que no te dejas ninguno:
LUNES: N bloques → bloque1 / bloque2 / ...
MARTES: N bloques → bloque1 / bloque2 / ...
(una línea por día)

Luego escribe exactamente: ===JSON===
Y el array JSON completo sin markdown:
[{"date":"...","block":1,"title":"...","type":"...","description":"..."}]`,
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()

  const delimiter = '===JSON==='
  const delimPos = raw.indexOf(delimiter)
  let extracted: string
  if (delimPos !== -1) {
    extracted = raw.slice(delimPos + delimiter.length).trim()
  } else {
    const jsonStart = raw.lastIndexOf('[{')
    const jsonEnd = raw.lastIndexOf(']')
    extracted = jsonStart !== -1 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw
  }
  const cleaned = extracted.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const wods = JSON.parse(cleaned)
    const normalized = wods.map((w: Record<string, unknown>) => ({
      ...w,
      type: VALID_TYPES.has(w.type as string) ? w.type : 'Other',
    }))
    const reviewed = await reviewTypes(normalized)
    return NextResponse.json({ wods: reviewed })
  } catch {
    return NextResponse.json({ error: 'Error al interpretar la imagen' }, { status: 500 })
  }
}
