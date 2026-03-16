import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, userId } = await req.json()

  if (!token || !userId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // Verificar que el userId corresponde a un usuario real
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
  if (userError || !user) {
    return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 })
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
    .eq('id', userId)

  return NextResponse.json({ ok: true })
}
