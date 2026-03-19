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

  const { email, programId, programSlug } = await req.json()

  if (!email || !programId || !programSlug) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const isOwner = await isProgramOwner(user.id, programId)
  if (!isOwner) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  // 1. Buscar usuario por email directamente en profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'No existe ningún usuario con ese email' }, { status: 404 })
  }

  if (profile.role === 'coach') {
    return NextResponse.json({ error: 'Este usuario es coach, no atleta' }, { status: 400 })
  }

  // 3. Verificar que no está ya en el programa
  const { data: existing } = await supabase
    .from('athlete_programs')
    .select('id')
    .eq('athlete_id', profile.id)
    .eq('program_id', programId)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'El atleta ya está en este programa' }, { status: 400 })
  }

  // 4. Añadir al programa
  await supabase
    .from('athlete_programs')
    .insert({ athlete_id: profile.id, program_id: programId })

  // 5. Actualizar profiles.program para que aparezca en getAthletes
  await supabase
    .from('profiles')
    .update({ program: programSlug, role: 'athlete' })
    .eq('id', profile.id)

  return NextResponse.json({ profile: { ...profile, program: programSlug } })
}
