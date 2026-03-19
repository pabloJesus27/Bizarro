import { NextRequest, NextResponse } from 'next/server'
import { checkAuthRateLimit } from '@/lib/auth-rate-limit'

const LIMITS: Record<string, { limit: number; windowMinutes: number }> = {
  register:       { limit: 3, windowMinutes: 60 },
  reset_password: { limit: 3, windowMinutes: 60 },
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, action } = body as { email?: string; action?: string }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email es requerido.' }, { status: 400 })
  }

  if (!action || !LIMITS[action]) {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const { limit, windowMinutes } = LIMITS[action]
  const allowed = await checkAuthRateLimit(normalizedEmail, action, limit, windowMinutes)

  if (!allowed) {
    const messages: Record<string, string> = {
      register:       'Demasiados intentos de registro. Espera 60 minutos.',
      reset_password: 'Demasiados intentos. Espera 60 minutos e inténtalo de nuevo.',
    }
    return NextResponse.json(
      { allowed: false, retryAfterMinutes: windowMinutes, error: messages[action] },
      { status: 200 }
    )
  }

  return NextResponse.json({ allowed: true })
}
