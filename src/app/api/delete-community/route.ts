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

  const { communityId } = await req.json()
  if (!communityId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  // Verificar ownership
  const { data: community } = await supabase
    .from('programs')
    .select('id, slug, owner_id, type')
    .eq('id', communityId)
    .single()

  if (!community) return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 })
  if (community.type !== 'community') return NextResponse.json({ error: 'No es una comunidad' }, { status: 400 })
  if (community.owner_id !== user.id) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  // Eliminar WODs de la comunidad (no hay CASCADE en wods.program)
  await supabase.from('wods').delete().eq('program', community.slug)

  // Eliminar comunidad (CASCADE elimina athlete_programs + community_invites)
  const { error } = await supabase.from('programs').delete().eq('id', communityId)
  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
