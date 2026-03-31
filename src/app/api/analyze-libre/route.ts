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

const TIMER_FORMAT = `timerConfig: usa SIEMPRE formato mix con bloques. Cada bloque: {"label":"...","seconds":N}.
- Warmup, Strength, Gymnastics, Core, Mobility → null
- For Time sin time cap → [{"label":"For Time","seconds":0,"countUp":true}] (cuenta arriba, el atleta para manualmente)
- For Time con time cap X min → [{"label":"For Time","seconds":X*60,"countUp":true}]
- AMRAP N min → [{"label":"AMRAP","seconds":N*60}]
- EMOM N min con intervalos de X seg → 1 bloque [{"label":"EMOM","seconds":N*60,"intervalSeconds":X}] (EMOM estándar = intervalSeconds:60, E2MOM = intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → (Y/X) bloques {"label":"Ronda 1","seconds":X*60}... (cada bloque es un esfuerzo máximo distinto)
- Tabata work W seg / rest R seg × N rondas → N pares alternando {"label":"Trabajo","seconds":W} y {"label":"Descanso","seconds":R}
- Estructura compleja (AMRAP + descanso + AMRAP, etc.) → bloques separados con label descriptivo
- N sets con M ejercicios en formato "X" on X" off" y descanso Y" entre sets → expande completamente: por cada set crea [Ejercicio1(Xs), Descanso(Xs), Ejercicio2(Xs), Descanso(Xs), ...] y añade Descanso(Ys) al final de cada set excepto el último. Ej: "3 sets, 30" on 30" off, DU / Thrusters / Burpees, rest 90" entre sets" → 17 bloques: [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s),Desc(90s)] × 2 + [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s)]
- El label de cada bloque debe ser corto y descriptivo de lo que ocurre en ese bloque
- En notación CrossFit: X" = X segundos, X' = X minutos. Ej: 30" = 30 seg, 3' = 180 seg
- Los bloques de descanso (off, rest) SIEMPRE deben tener su duración en segundos correcta
- "X sets / X rondas" SIN descanso explícito entre sets → For Time simple (1 solo bloque)
- Nunca uses seconds: 0 salvo en For Time sin time cap con countUp: true`

const WOD_FIELDS = `Para cada bloque:
- date: fecha en formato YYYY-MM-DD
- block: número de bloque (1=Warm Up, 2=Bloque #1, 3=Bloque #2, etc.)
- title: nombre corto del ejercicio principal (máx 4 palabras)
- type: "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo del bloque tal como aparece
- timerConfig: configuración del timer (ver reglas abajo), o null si no aplica`

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

IMPORTANTE — estructura de la imagen:
- La imagen es una tabla donde cada COLUMNA es un día de la semana: primera columna = Lunes, segunda = Martes, y así sucesivamente.
- Antes de extraer nada, identifica visualmente la posición horizontal (coordenada X) de cada columna usando los encabezados de día como referencia. Esa posición X define a qué día pertenece cualquier celda, independientemente de su fila.
- DEBES procesar la imagen COLUMNA por COLUMNA. Termina de extraer TODOS los bloques de Lunes antes de pasar a Martes, etc.
- Para cada columna: recórrela de arriba a abajo leyendo ÚNICAMENTE el contenido dentro de esa franja horizontal. El contenido de columnas adyacentes no existe mientras procesas esta columna.
- Las filas de separación (DESCANSO, HIDRATACION, etc.) ocupan toda la fila y NO son bloques. Cuando encuentres una, ignórala y re-ancla visualmente cada columna volviendo a mirar los encabezados de día para confirmar la posición X de cada una ANTES de continuar leyendo las filas siguientes.
- Una celda vacía en una fila no interrumpe la lectura del resto de la columna. Sigue hacia abajo.
- Al asignar un bloque, verifica SIEMPRE que su posición horizontal corresponde a la columna que estás procesando, no a una adyacente.
- Si una columna tiene pocas celdas o ninguna en las filas inferiores, es correcto — no añadas contenido que visualmente pertenece a otras columnas.
- Asigna block = 1 al primer bloque de ejercicio de cada día, block = 2 al segundo, etc. (numeración independiente por día, sin contar filas de separación). El número de bloque DEBE reflejar el orden visual de arriba a abajo: la celda más alta es siempre block=1, la siguiente block=2, y así sucesivamente.

Para cada celda con contenido, devuelve un WOD con:
- date: fecha YYYY-MM-DD del día correspondiente
- block: número de bloque según la regla de arriba
- title: identifica la parte PRINCIPAL del bloque. Para fuerza/halterofilia usa solo el ejercicio final (ej: "Cluster", "Clean & Jerk", "Back Squat"). Para WODs metabólicos usa los ejercicios principales separados por '+' (ej: "Assault Bike + Burpees"). Máximo 4 palabras.
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo exacto del WOD tal como aparece en la imagen
- timerConfig: configuración del timer (ver reglas abajo), o null si no aplica

Reglas de tipo:
- Calentamiento, activación, warm up → "Warmup"
- Sets/reps con barra o pesas, halterofilia, powerlifting → "Strength"
- Handstand, muscle up, ring, dominadas, gymnastics → "Gymnastics"
- Ejercicios de core, abdominales, plancha, GHD → "Core"
- Estiramientos, movilidad, foam roller, recuperación activa → "Mobility"
- AMRAP → "AMRAP"
- For time / tiempo límite / completar X trabajo lo antes posible → "For Time"
- Circuitos con ejercicios metabólicos (assault bike, remo, ski erg, burpees, wall balls, box jumps, double unders, kettlebell, thrusters...) aunque no diga explícitamente "for time" → "For Time"
- EMOM/E2MOM → "EMOM"
- Max cal/reps / "max [ejercicio]" en ventanas de tiempo (aunque sea X" on X" off con varios ejercicios) → "For Max"
- Bloque de N sets con ejercicios variados SIN formato de tiempo explícito (AMRAP/EMOM/for time/max) y SIN ser halterofilia/fuerza → "Warmup" si parece activación o acondicionamiento general, "Other" si no encaja en ninguna categoría
- Resto → "Other"

${TIMER_FORMAT}

Antes de escribir el JSON, escribe una línea por cada día con los bloques que ves en esa columna (usa / como separador):
LUNES: bloque1 / bloque2 / ...
MARTES: bloque1 / bloque2 / ...
(continúa para cada día con contenido)

Luego escribe exactamente esta línea: ===JSON===
Y a continuación el array JSON completo, sin markdown:
[{"date":"...","block":1,"title":"...","type":"...","description":"...","timerConfig":...}]`

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

  // Extraer el array JSON: buscar delimitador ===JSON=== o, como fallback, el último [{ del texto
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
