import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_TYPES = new Set(['For Time','AMRAP','EMOM','Strength','Gymnastics','Core','Mobility','Warmup','For Max','Other'])

interface RawWod { date: string; block: number; description: string; notes?: string }
interface FullWod { date: string; block: number; title: string; type: string; description: string; notes?: string }

async function enrichWods(raws: RawWod[]): Promise<FullWod[]> {
  const list = raws.map((w, i) =>
    `${i}. [${w.date} bloque ${w.block}] ${w.description}`
  ).join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Para cada bloque de CrossFit genera un título corto y asigna el tipo correcto.

Tipos válidos: Warmup | Strength | Gymnastics | Core | Mobility | For Time | AMRAP | EMOM | For Max | Other

Reglas de tipo (aplica en orden estricto, la primera que encaje gana — para en cuanto encuentres una coincidencia):
1. Contiene "AMRAP" explícito → AMRAP
2. Contiene "EMOM" o "E2MOM" explícito → EMOM
3. COMPRUEBA PRIMERO: ¿el texto termina con "max cal [ejercicio]" o "max reps [ejercicio]" como métrica final? (ej: "...max cal row", "...max cal bikeerg", "...max reps pull ups") → For Max. IMPORTANTE: "max bar muscle up" o "max pull ups" en medio de una lista de sets/reps NO cuenta — ahí "max" forma parte del nombre del ejercicio, no es la métrica.
4. Contiene formato "X'' on X'' off" o "X'' work X'' rest" → For Max
5. "ventanas de X min" con trabajo fijo por ventana → For Max
6. N sets de reps fijas con descanso (ej: "10 sets 7 toes to bar 7 burpee rest 1 min") → For Time
7. "for time" explícito, time cap → For Time
8. Carrera de distancia fija única sin sets ni rondas → For Time
9. N sets con 2 o más ejercicios distintos mezclados sin formato de tiempo → Warmup SIEMPRE, aunque alguno sea de gymnastics (dominadas, hollow rocks, pull ups, ring row…) o lleve distancias cortas (40m). Ejemplos: "3 sets: 10 dominadas escápula + 10 buenos días + 10 hollow rocks", "3 sets: 40m paso del camarero + 30 jumping jacks + 20 mountain climbers" → Warmup.
10. Calentamiento, activación, warm up → Warmup
11. Trabajo de gymnastics a calidad sin tiempo, con 1 solo tipo de movimiento de habilidad (muscle up, handstand walk, double unders técnico) en sets → Gymnastics. SOLO si el bloque se centra en UN único ejercicio de gymnastics de habilidad.
12. Sets/reps con barra, halterofilia, pesas, o musculación (lateral raises, curl, triceps, extensiones, femoral, abducciones) → Strength
13. Core, abdominales, plancha, GHD, hollow body → Core
14. Movilidad, estiramientos, foam roller → Mobility
15. Resto → Other

Reglas de título (máx 4 palabras):
- Fuerza/halterofilia: solo el ejercicio principal (ej: "Back Squat", "Power Snatch")
- WOD metabólico: ejercicios clave separados por + (ej: "Toes to Bar + Burpees")
- Warmup/activación: los 2-3 ejercicios principales (ej: "Ring Row + V-ups")
- Movilidad: el movimiento principal (ej: "Rotaciones Hombro", "90/90 Cadera")
- El título debe derivarse ÚNICAMENTE del texto de la descripción del bloque

Bloques:
${list}

Devuelve SOLO un array JSON con todos los bloques, sin markdown:
[{"i":0,"title":"...","type":"..."},...]`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  const jsonStart = raw.indexOf('[')
  const jsonEnd = raw.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1) {
    return raws.map(w => ({ ...w, title: 'WOD', type: 'Other' }))
  }

  try {
    const enriched: { i: number; title: string; type: string }[] = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return raws.map((w, i) => {
      const e = enriched.find(x => x.i === i)
      return {
        ...w,
        title: e?.title ?? 'WOD',
        type: e && VALID_TYPES.has(e.type) ? e.type : 'Other',
      }
    })
  } catch {
    return raws.map(w => ({ ...w, title: 'WOD', type: 'Other' }))
  }
}

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

    let visionPrompt: string

    if (mode === 'week') {
      const [lunes, martes, miercoles, jueves, viernes, sabado] = weekDates
      visionPrompt = `Analiza esta imagen con la programación semanal de CrossFit y extrae el texto de cada celda.

Las fechas de esta semana son:
- LUNES = ${lunes}
- MARTES = ${martes}
- MIÉRCOLES = ${miercoles}
- JUEVES = ${jueves}
- VIERNES = ${viernes}
- SÁBADO = ${sabado}

ESTRUCTURA DE LA TABLA:
- Cada COLUMNA es un día. Usa los encabezados (LUNES, MARTES…) para saber a qué día pertenece cada celda.
- Las líneas horizontales de la tabla dividen las filas. Cada celda delimitada por esas líneas es UN bloque.
- Hay un separador "DESCANSO / HIDRATACION" a mitad de la tabla — no es un bloque, ignóralo, pero las filas que vienen después de él SÍ son bloques reales.

REGLA CRÍTICA — una celda = un bloque:
El texto dentro de una celda puede tener múltiples líneas, párrafos o notas del coach. NUNCA dividas el contenido de una sola celda en bloques distintos.

REGLA — separa descripción de notas:
Cada celda puede tener dos partes:
- description: las instrucciones de ejecución (sets, reps, tiempos, porcentajes, RPE, distancias). Solo lo que el atleta necesita para ejecutar el WOD.
- notes: texto explicativo del coach (contexto, por qué, consejos técnicos, indicaciones de intensidad). Se identifica por: separadores (---), sección "*Notas:" o "Nota:", párrafos largos explicativos con frases como "El objetivo de...", "El esquema es...", "La velocidad de...", "Las primeras series...".
Si no hay notas, omite el campo notes.

REGLA CRÍTICA — captura la primera línea de cada celda:
Muchas celdas empiezan con "N sets", "N rondas", "N rounds" o similar en la primera línea. Esa primera línea es parte de la description y DEBE incluirse. No la omitas aunque sea breve.

REGLA CRÍTICA — copia literal, nunca inventes:
La description debe ser una transcripción exacta del texto visible en la celda. NUNCA añadas palabras, tiempos de descanso, repeticiones ni ningún dato que no esté escrito explícitamente en la imagen. Si algo no se ve con claridad, omítelo — nunca lo completes con suposiciones.

PROCESO (columna por columna):
1. Empieza por LUNES. Recorre sus celdas de arriba a abajo, incluyendo las que están después del separador DESCANSO.
2. Para cada celda con texto real de entrenamiento, genera un bloque. Si la celda está vacía, omítela sin generar nada.
3. Numera los bloques de ese día de forma independiente (1, 2, 3…).
4. Repite para MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO.
5. No mezcles contenido entre columnas. Cada celda pertenece solo a su columna.

Para cada bloque devuelve SOLO:
- date: fecha YYYY-MM-DD del día
- block: número de bloque (1, 2, 3… por día)
- description: solo las instrucciones de ejecución (sets, reps, tiempos, porcentajes, RPE), incluyendo cualquier prefijo como "N sets", "N rondas", "N rounds"
- notes: (opcional) texto explicativo del coach. Omite si no hay notas.

Antes del JSON escribe una línea por día con el conteo:
LUNES: N bloques
MARTES: N bloques
...

Luego escribe exactamente: ===JSON===
Y el array JSON sin markdown:
[{"date":"...","block":1,"description":"...","notes":"..."}]`

    } else if (mode === 'day') {
      visionPrompt = `Analiza esta imagen con el entrenamiento del día y extrae todos los bloques de ejercicio.

La fecha es: ${date}

REGLA CRÍTICA — copia literal, nunca inventes:
La description debe ser una transcripción exacta del texto visible. NUNCA añadas datos que no estén escritos en la imagen.

REGLA — separa descripción de notas:
- description: solo las instrucciones de ejecución (sets, reps, tiempos, porcentajes, RPE, distancias).
- notes: (opcional) texto explicativo del coach. Se identifica por: separadores (---), "*Notas:", párrafos largos como "El objetivo de...", "El esquema es...". Omite si no hay notas.

Para cada bloque devuelve SOLO:
- date: "${date}"
- block: número de bloque (1, 2, 3…)
- description: solo las instrucciones de ejecución
- notes: (opcional) texto explicativo del coach

Ignora notas de hidratación, nutrición o recordatorios que no sean ejercicio.

Luego escribe exactamente: ===JSON===
Y el array JSON sin markdown:
[{"date":"${date}","block":1,"description":"...","notes":"..."}]`

    } else {
      visionPrompt = `Analiza esta imagen con un WOD de CrossFit.

La fecha es: ${date}

REGLA CRÍTICA — todo es UN solo WOD:
Aunque la imagen contenga secciones A, B, C, D, múltiples partes o bloques diferenciados, TODA la imagen forma un único WOD. Devuelve exactamente 1 elemento en el array con TODO el texto concatenado como description.

REGLA — separa descripción de notas:
- description: solo las instrucciones de ejecución (sets, reps, tiempos, porcentajes, RPE, distancias).
- notes: (opcional) texto explicativo del coach (contexto, consejos técnicos, por qué). Se identifica por: separadores (---), "*Notas:", párrafos largos explicativos como "El objetivo de...", "El esquema es...", "La velocidad de...". Omite si no hay notas.

REGLA CRÍTICA — copia literal, nunca inventes:
La description debe ser una transcripción exacta del texto de ejecución visible. NUNCA añadas datos que no estén escritos en la imagen. NUNCA omitas instrucciones de ejecución.

Devuelve SOLO un array JSON con un único elemento, sin markdown:
[{"date":"${date}","block":1,"description":"...","notes":"..."}]`
    }

    let msg
    try {
      msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: visionPrompt },
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
      const raws: RawWod[] = JSON.parse(cleaned)
      const wods = await enrichWods(raws)
      return NextResponse.json({ wods })
    } catch {
      return NextResponse.json({ error: 'Error al interpretar la imagen' }, { status: 500 })
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Error interno: ${errMsg}` }, { status: 500 })
  }
}
