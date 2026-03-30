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
- Max cal / max reps / ventanas de X min con ejercicio a máximo esfuerzo → "For Max"
- Resto → "Other"

Reglas para timerConfig: usa SIEMPRE formato mix con bloques. Cada bloque: {"label":"...","seconds":N}.
- Warmup, Strength, Gymnastics, Core, Mobility → null
- For Time sin time cap → null
- For Time con time cap X min → [{"label":"For Time","seconds":X*60,"countUp":true}]
- AMRAP N min → [{"label":"AMRAP","seconds":N*60}]
- EMOM N min con intervalos de X seg → 1 bloque [{"label":"EMOM","seconds":N*60,"intervalSeconds":X}] (EMOM estándar = intervalSeconds:60, E2MOM = intervalSeconds:120, etc.)
- For Max ventanas de X min durante Y min → (Y/X) bloques {"label":"Ronda 1","seconds":X*60}... (cada bloque es un esfuerzo máximo distinto)
- Tabata work W seg / rest R seg × N rondas → N pares alternando {"label":"Trabajo","seconds":W} y {"label":"Descanso","seconds":R}
- Estructura compleja (AMRAP + descanso + AMRAP, etc.) → tantos bloques como partes haya con label descriptivo y seconds correcto
- N sets con M ejercicios en formato "X" on X" off" y descanso Y" entre sets → expande completamente: por cada set crea [Ejercicio1(Xs), Descanso(Xs), Ejercicio2(Xs), Descanso(Xs), ...] y añade Descanso(Ys) al final de cada set excepto el último. Ej: "3 sets, 30" on 30" off, DU / Thrusters / Burpees, rest 90" entre sets" → 17 bloques: [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s),Desc(90s)] × 2 + [DU(30s),Desc(30s),Thrusters(30s),Desc(30s),Burpees(30s)]
- Nunca uses seconds: 0 en un bloque

Ignora las celdas vacías y las filas de separación (DESCANSO, etc), pero SIGUE extrayendo los bloques que aparecen debajo del separador — pertenecen a los mismos días. Los bloques tras el separador corresponden al Warm Up 2 (bloque 4) y siguientes.

Devuelve SOLO un array JSON sin markdown ni explicaciones:
[{"date":"...","block":1,"title":"...","type":"...","description":"...","timerConfig":...}]`,
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()

  // Limpiar posible markdown
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
