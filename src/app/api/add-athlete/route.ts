import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, programId, programSlug } = await req.json()

  if (!email || !programId || !programSlug) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // 1. Buscar usuario por email
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) return NextResponse.json({ error: 'Error al buscar usuario' }, { status: 500 })

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) {
    return NextResponse.json({ error: 'No existe ningún usuario con ese email' }, { status: 404 })
  }

  // 2. Verificar que tiene perfil de atleta
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'El usuario no tiene perfil' }, { status: 404 })
  }

  if (profile.role === 'coach') {
    return NextResponse.json({ error: 'Este usuario es coach, no atleta' }, { status: 400 })
  }

  // 3. Verificar que no está ya en el programa
  const { data: existing } = await supabase
    .from('athlete_programs')
    .select('id')
    .eq('athlete_id', authUser.id)
    .eq('program_id', programId)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'El atleta ya está en este programa' }, { status: 400 })
  }

  // 4. Añadir al programa
  await supabase
    .from('athlete_programs')
    .insert({ athlete_id: authUser.id, program_id: programId })

  // 5. Actualizar profiles.program para que aparezca en getAthletes
  await supabase
    .from('profiles')
    .update({ program: programSlug, role: 'athlete' })
    .eq('id', authUser.id)

  return NextResponse.json({ profile: { ...profile, program: programSlug } })
}
