import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function checkAuthRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const normalizedIdentifier = identifier.toLowerCase().trim()

  try {
    const { data, error } = await supabaseAdmin.rpc(
      'check_and_record_auth_attempt',
      {
        p_identifier:     normalizedIdentifier,
        p_action:         action,
        p_limit:          limit,
        p_window_minutes: windowMinutes,
      }
    )

    if (error) {
      return true // fail-open
    }

    return data as boolean
  } catch {
    return true // fail-open
  }
}
