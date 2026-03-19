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

  const { athleteId, programId } = await req.json()

  if (!athleteId || !programId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  if (athleteId !== user.id) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  const { error } = await supabase
    .from('join_requests')
    .upsert(
      { athlete_id: athleteId, program_id: programId, status: 'pending' },
      { onConflict: 'athlete_id,program_id' }
    )

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
