import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAuthRateLimit } from '@/lib/auth-rate-limit'

const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MINUTES = 15

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, password } = body as { email?: string; password?: string }

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email y contraseña son requeridos.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const allowed = await checkAuthRateLimit(normalizedEmail, 'login', LOGIN_LIMIT, LOGIN_WINDOW_MINUTES)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Por favor espera 15 minutos antes de volver a intentarlo.' },
      { status: 429 }
    )
  }

  // Use anon key — NOT service role (service role bypasses password validation)
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error || !data.session) {
    return NextResponse.json(
      { error: 'Email o contraseña incorrectos.' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    session: {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at:    data.session.expires_at,
      user:          data.session.user,
    },
  })
}
