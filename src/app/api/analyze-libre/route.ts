import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMER_FORMAT = `timerConfig: usa SIEMPRE formato mix con bloques. Cada bloque: {"label":"...","seconds":N}.
- Warmup, Strength, Gymnastics, Core, Mobility → null
- For Time sin time cap → null
- For Time con time cap X min → [{"label":"For Time","seconds":X*60,"countUp":true}]
- AMRAP N min → [{"label":"AMRAP","seconds":N*60}]
- EMOM N min con intervalos de X seg → 1 bloque [{"label":"EMOM","seconds":N*60,"intervalSeconds":X}] (EMOM estándar = intervalSeconds:60, E2MOM = intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → (Y/X) bloques {"label":"Ronda 1","seconds":X*60}... (cada bloque es un esfuerzo máximo distinto)
- Tabata work W seg / rest R seg × N rondas → N pares alternando {"label":"Trabajo","seconds":W} y {"label":"Descanso","seconds":R}
- Estructura compleja (AMRAP + descanso + AMRAP, etc.) → bloques separados con label descriptivo
- N sets con M ejercicios en formato "X" on X" off" y descanso Y" entre sets → expande completamente: por cada set crea [Ejercicio1(Xs), Descanso(Xs), Ejercicio2(Xs), Descanso(Xs), ...] y añade Descanso(Ys) al final de cada set excepto el último. Ej: "3 sets, 30" on 30" off, DU / Thrusters / Burpees, rest 90" entre sets" → 17 bloques: [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s),Desc(90s)] × 2 + [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s)]
- Nunca uses seconds: 0 en un bloque`

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

${WOD_FIELDS}

IMPORTANTE — estructura de la imagen:
- La imagen es una tabla donde cada COLUMNA es un día de la semana: primera columna = Lunes, segunda = Martes, y así sucesivamente.
- Cada FILA es un bloque de entrenamiento. Recorre cada columna completa de arriba a abajo y extrae todo el contenido que encuentres.
- Las filas de separación (DESCANSO, HIDRATACION, descanso activo, etc.) ocupan toda la fila y NO son bloques. Ignóralas por completo y sigue leyendo las filas que hay debajo — siguen siendo bloques de ese mismo día.
- Una celda vacía significa que ese día no tiene bloque en esa posición. No interrumpe la lectura del resto de filas.
- Asigna block = 1 al primer contenido de ejercicio de cada día, block = 2 al segundo, etc. (numeración independiente por día, ignorando las filas de separación al contar).

Reglas de tipo:
- Calentamiento, activación, warm up → "Warmup"
- Sets/reps con barra o pesas, halterofilia, powerlifting → "Strength"
- Handstand, muscle up, ring, dominadas, gymnastics → "Gymnastics"
- Ejercicios de core, abdominales, plancha, GHD → "Core"
- Estiramientos, movilidad, foam roller, recuperación activa → "Mobility"
- AMRAP → "AMRAP"
- For time / tiempo límite / completar X trabajo lo antes posible → "For Time"
- Circuitos con ejercicios metabólicos (assault bike, remo, ski erg, burpees, wall balls, box jumps, double unders, kettlebell, thrusters...) aunque no diga explícitamente "for time" → "For Time"
- EMOM/E2MOM → "EMOM", Max cal/reps / ventanas de X min a máximo esfuerzo → "For Max", resto → "Other"

Reglas de título: identifica la parte PRINCIPAL del bloque. Para fuerza/halterofilia usa solo el ejercicio final (ej: "Cluster", "Clean & Jerk", "Back Squat"). Para WODs metabólicos usa los ejercicios principales (ej: "Assault Bike + Burpees", "Thrusters + Pull Ups"). Máximo 4 palabras.

Ignora solo: celdas completamente vacías, filas de DESCANSO/separación, notas de nutrición e hidratación sin ejercicio.

${TIMER_FORMAT}

Para Warmup, Strength, Gymnastics, Core, Mobility: timerConfig = null salvo que haya un timer explícito.
Devuelve SOLO un array JSON sin markdown:
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
