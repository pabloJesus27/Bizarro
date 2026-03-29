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

  const { communitySlug, email } = await req.json()
  if (!communitySlug || !email) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  // Obtener la comunidad y verificar ownership
  const { data: community } = await supabase
    .from('programs')
    .select('id, owner_id')
    .eq('slug', communitySlug)
    .eq('type', 'community')
    .single()

  if (!community) return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 })
  if (community.owner_id !== user.id) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  // Contar miembros actuales
  const { count } = await supabase
    .from('athlete_programs')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', community.id)

  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Límite de 10 miembros alcanzado' }, { status: 403 })

  // Verificar si el email ya es miembro (via auth.users)
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authUser = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (authUser) {
    const { data: alreadyMember } = await supabase
      .from('athlete_programs')
      .select('id')
      .eq('program_id', community.id)
      .eq('athlete_id', authUser.id)
      .single()

    if (alreadyMember) return NextResponse.json({ error: 'Ya es miembro de esta comunidad' }, { status: 409 })
  }

  // Crear invitación
  const { data: invite, error: inviteError } = await supabase
    .from('community_invites')
    .insert({ community_id: community.id, invited_email: email.toLowerCase() })
    .select('token')
    .single()

  if (inviteError || !invite) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ token: invite.token })
}
