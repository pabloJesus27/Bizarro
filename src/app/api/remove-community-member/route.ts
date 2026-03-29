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

  const { communityId, athleteId } = await req.json()
  if (!communityId || !athleteId) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

  // Verificar que el solicitante es el owner
  const { data: community } = await supabase
    .from('programs')
    .select('owner_id')
    .eq('id', communityId)
    .eq('type', 'community')
    .single()

  if (!community || community.owner_id !== user.id)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // No puede expulsarse a sí mismo (debe usar eliminar comunidad)
  if (athleteId === user.id)
    return NextResponse.json({ error: 'No puedes expulsarte a ti mismo' }, { status: 400 })

  const { error } = await supabase
    .from('athlete_programs')
    .delete()
    .eq('program_id', communityId)
    .eq('athlete_id', athleteId)

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
