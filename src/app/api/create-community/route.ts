import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toSlug(name: string): string {
  return 'c-' + name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  // Verificar que no pertenece ya a ninguna comunidad (ni como owner ni como miembro)
  const { data: existingMembership } = await supabase
    .from('athlete_programs')
    .select('id, programs!inner(type)')
    .eq('athlete_id', user.id)
    .eq('programs.type', 'community')
    .maybeSingle()

  if (existingMembership) return NextResponse.json({ error: 'Ya perteneces a una comunidad' }, { status: 409 })

  const slug = toSlug(name.trim())
  if (slug === 'c-') return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })

  // Verificar que el slug no está en uso
  const { data: slugTaken } = await supabase
    .from('programs')
    .select('id')
    .eq('slug', slug)
    .single()

  if (slugTaken) return NextResponse.json({ error: 'Ese nombre ya está en uso, elige otro' }, { status: 409 })

  // Crear el programa con type='community'
  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({ name: name.trim(), slug, owner_id: user.id, type: 'community' })
    .select()
    .single()

  if (programError || !program) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  // Añadir al creador como primer miembro
  const { error: memberError } = await supabase
    .from('athlete_programs')
    .insert({ athlete_id: user.id, program_id: program.id })

  if (memberError) return NextResponse.json({ error: 'Error interno' }, { status: 500 })

  return NextResponse.json({ slug })
}
