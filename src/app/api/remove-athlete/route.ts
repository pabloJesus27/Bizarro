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

  // Obtener slug del programa para comparar con profiles.program
  const { data: program } = await supabase
    .from('programs')
    .select('slug')
    .eq('id', programId)
    .single()

  // Eliminar de athlete_programs
  await supabase
    .from('athlete_programs')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('program_id', programId)

  // Eliminar join_requests para que pueda volver a solicitar
  await supabase
    .from('join_requests')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('program_id', programId)

  // Limpiar profiles.program solo si era este programa
  if (program?.slug) {
    await supabase
      .from('profiles')
      .update({ program: null })
      .eq('id', athleteId)
      .eq('program', program.slug)
  }

  return NextResponse.json({ ok: true })
}
