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

  const slug     = req.nextUrl.searchParams.get('slug')
  const exercise = req.nextUrl.searchParams.get('exercise')
  if (!slug || !exercise) return NextResponse.json({ error: 'slug y exercise requeridos' }, { status: 400 })

  // Obtener programa (cualquier tipo)
  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!program) return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })

  // Verificar membresía
  const { data: membership } = await supabase
    .from('athlete_programs')
    .select('id')
    .eq('program_id', program.id)
    .eq('athlete_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No eres miembro' }, { status: 403 })

  // Obtener todos los miembros
  const { data: rows } = await supabase
    .from('athlete_programs')
    .select('athlete_id')
    .eq('program_id', program.id)

  if (!rows?.length) return NextResponse.json({ members: [] })

  const athleteIds = rows.map(r => r.athlete_id)

  // Perfiles + PRs en paralelo
  const [{ data: profiles }, { data: prs }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', athleteIds),
    supabase.from('personal_records')
      .select('user_id, weight')
      .in('user_id', athleteIds)
      .ilike('exercise', exercise),
  ])

  const members = athleteIds.map(id => {
    const profile = profiles?.find(p => p.id === id)
    const pr      = prs?.find(p => p.user_id === id)
    return {
      athlete_id: id,
      name:       profile?.full_name ?? 'Sin nombre',
      avatar_url: profile?.avatar_url ?? null,
      weight:     pr?.weight ?? null,
    }
  })

  return NextResponse.json({ members })
}
