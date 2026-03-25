import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, isProgramOwnerBySlug } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { program_slug, week_start, content } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Contenido vacío' }, { status: 400 })
  }

  const isOwner = await isProgramOwnerBySlug(user.id, program_slug)
  if (!isOwner) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('coach_messages')
    .upsert(
      { program_slug, week_start, content: content.trim(), created_by: user.id },
      { onConflict: 'program_slug,week_start' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
