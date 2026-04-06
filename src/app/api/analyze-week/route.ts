import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_TYPES = new Set(['For Time','AMRAP','EMOM','Strength','Gymnastics','Core','Mobility','Warmup','For Max','Other'])

interface RawWod { date: string; block: number; description: string }
interface FullWod { date: string; block: number; title: string; type: string; description: string }

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

Reglas de tipo (aplica en orden, la primera que encaje gana):
1. Contiene AMRAP → AMRAP
2. Contiene EMOM o E2MOM → EMOM
3. "max cal", "max reps", "max [ejercicio]", formato X" on X" off → For Max
4. "for time", time cap, lista de rondas metabólicas sin sets×reps → For Time
5. Carrera de distancia fija única sin sets ni rondas → For Time
6. N sets de ejercicios variados sin formato de tiempo explícito → Warmup
7. Calentamiento, activación, warm up → Warmup
8. Sets/reps con barra, halterofilia, pesas → Strength
9. Handstand, muscle up, ring dips, gymnastics → Gymnastics
10. Core, abdominales, plancha, GHD, hollow body → Core
11. Movilidad, estiramientos, foam roller → Mobility
12. Resto → Other

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
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const allowed = await checkAiRateLimit(user.id, 'analyze-week', 5)
  if (!allowed) return NextResponse.json(
    { error: 'Límite diario alcanzado. Inténtalo mañana.' },
    { status: 429 }
  )

  const { imageBase64, mediaType, weekDates } = await req.json()

  const [lunes, martes, miercoles, jueves, viernes, sabado] = weekDates

  // Pasada 1: visión — extrae solo date, block y description en crudo
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
          text: `Analiza esta imagen con la programación semanal de CrossFit y extrae el texto de cada celda.

Las fechas de esta semana son:
- LUNES = ${lunes}
- MARTES = ${martes}
- MIÉRCOLES = ${miercoles}
- JUEVES = ${jueves}
- VIERNES = ${viernes}
- SÁBADO = ${sabado}

ESTRUCTURA DE LA TABLA:
- Cada COLUMNA es un día. Usa los encabezados (LUNES, MARTES…) para identificar a qué día pertenece cada celda.
- Cada FILA es un bloque de entrenamiento. Hay filas ANTES y DESPUÉS del separador "DESCANSO / HIDRATACION".
- El separador "DESCANSO" NO es un bloque — ignóralo. Las filas después del separador SÍ son bloques reales.
- Algunos días tienen 6 bloques, otros 5, otros 2. Extrae todo el contenido visible, sin omitir filas.

PROCESO:
1. Cuenta cuántas filas tiene la tabla (sin el separador DESCANSO).
2. Para cada fila, procesa cada columna de izquierda a derecha.
3. Si la celda tiene texto, genera un bloque. Si está vacía, omítela.
4. Numera los bloques de cada día de forma independiente (1, 2, 3…).
5. Copia el texto de cada celda de forma LITERAL y COMPLETA, sin resumir ni interpretar.

Para cada bloque devuelve SOLO:
- date: fecha YYYY-MM-DD del día
- block: número de bloque (1, 2, 3… por día)
- description: texto completo y literal de la celda

Antes del JSON escribe una línea por día con el conteo:
LUNES: N bloques
MARTES: N bloques
...

Luego escribe exactamente: ===JSON===
Y el array JSON sin markdown:
[{"date":"...","block":1,"description":"..."}]`,
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
    const raws: RawWod[] = JSON.parse(cleaned)
    // Pasada 2: texto — genera title y type desde las descripciones
    const wods = await enrichWods(raws)
    return NextResponse.json({ wods })
  } catch {
    return NextResponse.json({ error: 'Error al interpretar la imagen' }, { status: 500 })
  }
}
