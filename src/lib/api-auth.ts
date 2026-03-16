import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthenticatedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function isProgramOwner(userId: string, programId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('programs')
    .select('owner_id')
    .eq('id', programId)
    .single()
  return data?.owner_id === userId
}
