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

const TYPE_RULES = `Reglas para el tipo:
- Warm Up / calentamiento / activación → "Warmup"
- Sets/reps con barra o pesas, halterofilia → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Core, abdominales, plancha, GHD → "Core"
- Estiramientos, movilidad, foam roller → "Mobility"
- AMRAP → "AMRAP"
- For time / tiempo límite / circuito metabólico → "For Time"
- EMOM / E2MOM → "EMOM"
- Max cal / max reps / X" on X" off → "For Max"
- Resto → "Other"`

export async function POST(req: NextRequest) {
  try {
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

IMPORTANTE — estructura de la imagen:
- La imagen es una tabla donde cada COLUMNA es un día de la semana: primera columna = Lunes, segunda = Martes, y así sucesivamente.
- Antes de extraer nada, identifica visualmente la posición horizontal (coordenada X) de cada columna usando los encabezados de día como referencia.
- DEBES procesar la imagen COLUMNA por COLUMNA. Termina de extraer TODOS los bloques de Lunes antes de pasar a Martes, etc.
- Las filas de separación (DESCANSO, HIDRATACION, etc.) NO son bloques — ignóralas.
- Asigna block = 1 al primer bloque de cada día, block = 2 al segundo, etc. (numeración independiente por día).

Para cada celda con contenido devuelve un objeto con:
- date: fecha YYYY-MM-DD del día correspondiente
- block: número de bloque (1, 2, 3...)
- title: nombre corto del ejercicio principal (máx 4 palabras). Para fuerza/halterofilia: solo el ejercicio final (ej: "Back Squat"). Para WODs metabólicos: ejercicios principales separados por '+' (ej: "Assault Bike + Burpees").
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo exacto del WOD tal como aparece en la imagen

${TYPE_RULES}

Antes de escribir el JSON, escribe una línea por cada día con los bloques que ves (usa / como separador):
LUNES: bloque1 / bloque2 / ...
MARTES: bloque1 / bloque2 / ...

Luego escribe exactamente esta línea: ===JSON===
Y a continuación el array JSON completo, sin markdown:
[{"date":"...","block":1,"title":"...","type":"...","description":"..."}]`

    } else if (mode === 'day') {
      promptText = `Analiza esta imagen con el entrenamiento del día y extrae todos los bloques.

La fecha es: ${date}

Para cada bloque devuelve un objeto con:
- date: "${date}"
- block: número de bloque (1, 2, 3...)
- title: nombre corto del ejercicio principal (máx 4 palabras)
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo del bloque tal como aparece en la imagen

${TYPE_RULES}
Ignora notas de hidratación, nutrición, recordatorios o cualquier cosa que no sea un bloque de ejercicio.

Devuelve SOLO un array JSON sin markdown:
[{"date":"${date}","block":1,"title":"...","type":"...","description":"..."}]`

    } else {
      promptText = `Analiza esta imagen con un WOD de CrossFit y extrae el bloque principal.

La fecha es: ${date}

Devuelve un objeto con:
- date: "${date}"
- block: 1
- title: nombre corto del ejercicio principal (máx 4 palabras)
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo del WOD tal como aparece en la imagen

${TYPE_RULES}
Si hay varios bloques visibles, extrae solo el bloque principal (el WOD metabólico o de mayor intensidad).
Ignora notas de hidratación, nutrición, recordatorios o cualquier cosa que no sea un bloque de ejercicio.

Devuelve SOLO un array JSON con un único elemento, sin markdown:
[{"date":"${date}","block":1,"title":"...","type":"...","description":"..."}]`
    }

    let msg
    try {
      msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: promptText },
          ],
        }],
      })
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error desconocido'
      return NextResponse.json({ error: `Error al contactar con la IA: ${errMsg}` }, { status: 500 })
    }

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
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Error interno: ${errMsg}` }, { status: 500 })
  }
}
