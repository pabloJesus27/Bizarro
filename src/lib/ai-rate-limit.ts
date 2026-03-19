import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function checkAiRateLimit(
  userId: string,
  endpoint: string,
  limit: number
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc(
      'check_and_increment_ai_usage',
      { p_user_id: userId, p_endpoint: endpoint, p_limit: limit }
    )

    if (error) {
      return true
    }

    return data as boolean
  } catch {
    return true
  }
}
