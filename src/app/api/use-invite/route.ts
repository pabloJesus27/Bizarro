import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // Buscar el token
  const { data: invite, error } = await supabase
    .from('coach_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invitación no válida' }, { status: 400 })
  }

  // Update atómico: solo actualiza si used_at IS NULL (evita race condition)
  const { data: claimed } = await supabase
    .from('coach_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)
    .is('used_at', null)
    .select()
    .single()

  if (!claimed) {
    return NextResponse.json({ error: 'Este enlace ya ha sido utilizado' }, { status: 400 })
  }

  // Actualizar el perfil del usuario a coach
  await supabase
    .from('profiles')
    .update({ role: 'coach' })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
