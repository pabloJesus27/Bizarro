import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, userId } = await req.json()

  // 1. Buscar el token
  const { data: invite, error } = await supabase
    .from('coach_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invitación no válida' }, { status: 400 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: 'Este enlace ya ha sido utilizado' }, { status: 400 })
  }

  // 2. Marcar como usado
  await supabase
    .from('coach_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  // 3. Actualizar el perfil del usuario a coach
  await supabase
    .from('profiles')
    .update({ role: 'coach' })
    .eq('id', userId)

  return NextResponse.json({ ok: true })
}
