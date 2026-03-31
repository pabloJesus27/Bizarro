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
11. Movilidad, estiramientos, foam roller, recuperación activa, trote suave, técnica de carrera, progresivos de carrera → Mobility
12. Resto → Other

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
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64,
          },
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
- title: identifica la parte PRINCIPAL del bloque (no el calentamiento ni los ejercicios técnicos previos). Para bloques de fuerza/halterofilia usa solo el nombre del ejercicio principal (ej: "Cluster", "Clean & Jerk", "Back Squat"). Si hay una progresión técnica antes del ejercicio principal (muscle clean, tall clean, drills), ignórala y pon solo el ejercicio final. Para WODs metabólicos usa los ejercicios principales separados por '+' (ej: "Assault Bike + Burpees", "Thrusters + Pull Ups"). Máximo 4 palabras.
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "Core" | "Mobility" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo exacto del WOD tal como aparece en la imagen
- timerConfig: configuración del timer (ver reglas abajo), o null si no aplica

Reglas para el tipo:
- Warm Up → siempre "Warmup"
- Sets/reps con barra o pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- Ejercicios de core, abdominales, giros de cintura, plancha, GHD → "Core"
- Estiramientos, foam roller, movilidad, recuperación activa → "Mobility"
- AMRAP → "AMRAP"
- For time / tiempo límite / completar X trabajo lo antes posible → "For Time"
- Circuitos de sets con ejercicios metabólicos (assault bike, remo, ski erg, toes to bar, burpees, wall balls, box jumps, double unders, sandbag, kettlebell, thrusters...) aunque no diga explícitamente "for time" → "For Time"
- EMOM → "EMOM"
- Max cal / max reps / "max [ejercicio]" en ventanas de tiempo (aunque sea X" on X" off con varios ejercicios) → "For Max"
- Bloque de N sets con ejercicios variados SIN formato de tiempo explícito (AMRAP/EMOM/for time/max) y SIN ser halterofilia/fuerza → "Warmup" si parece activación o acondicionamiento general, "Other" si no encaja en ninguna categoría
- Resto → "Other"

Reglas para timerConfig: usa SIEMPRE formato mix con bloques. Cada bloque: {"label":"...","seconds":N}.
- Warmup, Strength, Gymnastics, Core, Mobility → null
- For Time sin time cap → [{"label":"For Time","seconds":0,"countUp":true}] (cuenta arriba, el atleta para manualmente)
- For Time con time cap X min → [{"label":"For Time","seconds":X*60,"countUp":true}]
- AMRAP N min → [{"label":"AMRAP","seconds":N*60}]
- EMOM N min con intervalos de X seg → 1 bloque [{"label":"EMOM","seconds":N*60,"intervalSeconds":X}] (EMOM estándar = intervalSeconds:60, E2MOM = intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → (Y/X) bloques {"label":"Ronda 1","seconds":X*60}... (cada bloque es un esfuerzo máximo distinto)
- Tabata work W seg / rest R seg × N rondas → N pares alternando {"label":"Trabajo","seconds":W} y {"label":"Descanso","seconds":R}
- Estructura compleja (AMRAP + descanso + AMRAP, etc.) → tantos bloques como partes haya con label descriptivo y seconds correcto
- N sets con M ejercicios en formato "X" on X" off" y descanso Y" entre sets → expande completamente: por cada set crea [Ejercicio1(Xs), Descanso(Xs), Ejercicio2(Xs), Descanso(Xs), ...] y añade Descanso(Ys) al final de cada set excepto el último. Ej: "3 sets, 30" on 30" off, DU / Thrusters / Burpees, rest 90" entre sets" → 17 bloques: [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s),Desc(90s)] × 2 + [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s)]
- El label de cada bloque debe ser corto y descriptivo de lo que ocurre en ese bloque
- En notación CrossFit: X" = X segundos, X' = X minutos. Ej: 30" = 30 seg, 3' = 180 seg
- Los bloques de descanso (off, rest) SIEMPRE deben tener su duración en segundos correcta
- "X sets / X rondas" SIN descanso explícito entre sets → For Time simple (1 solo bloque)
- Nunca uses seconds: 0 salvo en For Time sin time cap con countUp: true

Antes de escribir el JSON, escribe una línea por cada día con los bloques que ves en esa columna (usa / como separador):
LUNES: bloque1 / bloque2 / ...
MARTES: bloque1 / bloque2 / ...
(continúa para cada día con contenido)

Luego escribe exactamente esta línea: ===JSON===
Y a continuación el array JSON completo, sin markdown:
[{"date":"...","block":1,"title":"...","type":"...","description":"...","timerConfig":...}]`,
        },
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
