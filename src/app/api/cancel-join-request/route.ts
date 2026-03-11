import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { athleteId, programId } = await req.json()

  if (!athleteId || !programId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const { error } = await supabase
    .from('join_requests')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('program_id', programId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
