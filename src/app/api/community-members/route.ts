import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug requerido' }, { status: 400 })

  // Obtener comunidad por slug
  const { data: community } = await supabase
    .from('programs')
    .select('id, name, slug, owner_id, type, created_at')
    .eq('slug', slug)
    .eq('type', 'community')
    .single()

  if (!community) return NextResponse.json({ error: 'Comunidad no encontrada' }, { status: 404 })

  const communityId = community.id

  // Verificar membresía y obtener miembros en paralelo
  const [{ data: membership }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from('athlete_programs').select('id').eq('program_id', communityId).eq('athlete_id', user.id).single(),
    supabase.from('athlete_programs').select('athlete_id, joined_at').eq('program_id', communityId).order('joined_at', { ascending: true }),
  ])

  if (!membership) return NextResponse.json({ error: 'No eres miembro de esta comunidad' }, { status: 403 })
  if (rowsError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  const athleteIds = rows.map(r => r.athlete_id)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles').select('id, full_name, avatar_url').in('id', athleteIds)

  if (profilesError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  const members = rows.map(r => ({
    athlete_id: r.athlete_id,
    joined_at: r.joined_at,
    profiles: profiles.find(p => p.id === r.athlete_id) ?? { full_name: null, avatar_url: null },
  }))

  return NextResponse.json({ community, members })
}
