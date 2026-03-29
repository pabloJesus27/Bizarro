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

  const communityId = req.nextUrl.searchParams.get('communityId')
  if (!communityId) return NextResponse.json({ error: 'communityId requerido' }, { status: 400 })

  // Verificar que el usuario es miembro de esta comunidad
  const { data: membership } = await supabase
    .from('athlete_programs')
    .select('id')
    .eq('program_id', communityId)
    .eq('athlete_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No eres miembro de esta comunidad' }, { status: 403 })

  const { data, error } = await supabase
    .from('athlete_programs')
    .select('athlete_id, joined_at, profiles(full_name, avatar_url)')
    .eq('program_id', communityId)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ members: data })
}
