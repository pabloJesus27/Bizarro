import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

Para cada celda con contenido, devuelve un WOD con:
- date: fecha YYYY-MM-DD del día correspondiente
- block: número de bloque (1 para Warm Up, 2 para Bloque #1, 3 para Bloque #2, 4 para Warm Up 2, 5 para Bloque #3, 6 para Bloque #4)
- title: título corto descriptivo (máximo 5 palabras)
- type: uno de "Warmup" | "Strength" | "Gymnastics" | "For Time" | "AMRAP" | "EMOM" | "For Max" | "Other"
- description: texto completo exacto del WOD tal como aparece en la imagen

Reglas para el tipo:
- Warm Up → siempre "Warmup"
- Sets/reps con barra o pesas → "Strength"
- Handstand, muscle up, ring, gymnastics → "Gymnastics"
- AMRAP → "AMRAP"
- For time / tiempo límite → "For Time"
- EMOM → "EMOM"
- Max cal / max reps → "For Max"
- Resto → "Other"

Ignora las celdas vacías y las filas de separación (DESCANSO, etc).

Devuelve SOLO un array JSON sin markdown ni explicaciones:
[{"date":"...","block":1,"title":"...","type":"...","description":"..."}]`,
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()

  // Limpiar posible markdown
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const wods = JSON.parse(cleaned)
    return NextResponse.json({ wods })
  } catch {
    return NextResponse.json({ error: 'Error al interpretar la imagen' }, { status: 500 })
  }
}
