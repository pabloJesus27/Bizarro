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
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  // Buscar la invitación
  const { data: invite } = await supabase
    .from('community_invites')
    .select('id, community_id, used_by')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invitación inválida' }, { status: 400 })
  if (invite.used_by) return NextResponse.json({ error: 'Esta invitación ya fue usada' }, { status: 400 })

  // Obtener info de la comunidad
  const { data: community } = await supabase
    .from('programs')
    .select('id, slug')
    .eq('id', invite.community_id)
    .single()

  if (!community) return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 })

  // Si ya es miembro, redirigir sin error
  const { data: alreadyMember } = await supabase
    .from('athlete_programs')
    .select('id')
    .eq('program_id', community.id)
    .eq('athlete_id', user.id)
    .single()

  if (alreadyMember) return NextResponse.json({ slug: community.slug })

  // Validación atómica del límite antes de insertar
  const { count } = await supabase
    .from('athlete_programs')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', community.id)

  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'La comunidad está llena' }, { status: 403 })

  // Añadir miembro
  const { error: memberError } = await supabase
    .from('athlete_programs')
    .insert({ athlete_id: user.id, program_id: community.id })

  if (memberError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  // Marcar invitación como usada
  await supabase
    .from('community_invites')
    .update({ used_by: user.id })
    .eq('id', invite.id)

  return NextResponse.json({ slug: community.slug })
}
