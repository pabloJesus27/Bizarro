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

  const body = await req.json()
  const { athleteId, programId } = body

  if (!athleteId || typeof athleteId !== 'string') {
    return NextResponse.json({ error: 'athleteId inválido' }, { status: 400 })
  }
  if (!programId || typeof programId !== 'string') {
    return NextResponse.json({ error: 'programId inválido' }, { status: 400 })
  }

  // Un atleta solo puede salirse a sí mismo — nunca a otro usuario
  if (user.id !== athleteId) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  // Obtener slug del programa para limpiar profiles.program si corresponde
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('slug')
    .eq('id', programId)
    .single()

  if (programError || !program) {
    return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })
  }

  // Eliminar de athlete_programs
  const { error: deleteError } = await supabase
    .from('athlete_programs')
    .delete()
    .eq('athlete_id', athleteId)
    .eq('program_id', programId)

  if (deleteError) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  // Limpiar profiles.program solo si era el programa activo del atleta
  await supabase
    .from('profiles')
    .update({ program: null })
    .eq('id', athleteId)
    .eq('program', program.slug)

  return NextResponse.json({ ok: true })
}
