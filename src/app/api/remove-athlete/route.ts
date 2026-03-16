import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isProgramOwner } from '@/lib/api-auth'

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

  // Permitir si es el dueño del programa (coach) O si el atleta se elimina a sí mismo
  const isOwner = await isProgramOwner(user.id, programId)
  const isSelf  = user.id === athleteId

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
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
