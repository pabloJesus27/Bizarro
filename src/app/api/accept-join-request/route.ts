import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthenticatedUser, isProgramOwner } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { requestId, athleteId, programId, programSlug } = await req.json()

  if (!requestId || !athleteId || !programId || !programSlug) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const isOwner = await isProgramOwner(user.id, programId)
  if (!isOwner) return NextResponse.json({ error: 'Prohibido' }, { status: 403 })

  const { error: rpcError } = await supabase.rpc('accept_join_request', {
    p_request_id:   requestId,
    p_athlete_id:   athleteId,
    p_program_id:   programId,
    p_program_slug: programSlug,
  })
  if (rpcError) return NextResponse.json({ error: 'Error al aceptar solicitud' }, { status: 500 })

  // Obtener email y nombre del atleta
  const { data: { user: athlete } } = await supabase.auth.admin.getUserById(athleteId)
  const { data: program } = await supabase.from('programs').select('name').eq('id', programId).single()

  if (athlete?.email && program?.name) {
    const athleteName = athlete.user_metadata?.full_name ?? 'Atleta'
    await resend.emails.send({
      from: 'Bizarro <onboarding@resend.dev>',
      to: athlete.email,
      subject: `¡Fuiste aceptado en ${program.name}!`,
      html: `
        <div style="font-family: monospace; background: #000; color: #fff; padding: 40px; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; margin-bottom: 8px;">
            ¡Bienvenido, ${athleteName}!
          </h1>
          <p style="color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 32px;">
            ${program.name}
          </p>
          <p style="color: #d4d4d4; font-size: 14px; line-height: 1.6;">
            Tu solicitud para unirte a <strong style="color: #fff;">${program.name}</strong> ha sido aceptada.<br/>
            Ya puedes acceder al programa desde la app.
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true })
}
