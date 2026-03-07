import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { title, description, type } = await req.json()

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Analiza este WOD de CrossFit y devuelve SOLO un objeto JSON (sin markdown) con la configuración del temporizador.

WOD:
Título: ${title}
Tipo: ${type}
Descripción: ${description}

Tipos de timer disponibles:
- amrap: { "type": "amrap", "totalSeconds": N }
- emom: { "type": "emom", "totalSeconds": N }
- fortime: { "type": "fortime", "capSeconds": N }  (capSeconds=0 SIEMPRE que no se mencione explícitamente un time cap; NO inventes time cap)
- interval: { "type": "interval", "totalSeconds": N, "intervalSeconds": N, "workLabel": "actividad principal en pocas palabras", "restLabel": "texto completo de lo que se hace al sonar la alarma", "startWithRest": bool }
- countdown: { "type": "countdown", "totalSeconds": N }

Reglas:
- AMRAP X MIN → amrap, totalSeconds = X*60
- EMOM X MIN → emom, totalSeconds = X*60
- For time / Completa → fortime, capSeconds=0 a menos que la descripción diga explícitamente "time cap X min"
- Workout con "cada X min" o "cada X'" → interval, intervalSeconds = X*60, restLabel = texto de lo que se hace en el intervalo, workLabel = actividad principal (ej: "BIKE — Max calorías"), startWithRest=true si dice "comienza con" la parte de fuerza
- Solo JSON, sin explicación ni markdown.`,
    }],
  })

  const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()

  try {
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch {
    return NextResponse.json({ error: 'parse_error' }, { status: 500 })
  }
}
