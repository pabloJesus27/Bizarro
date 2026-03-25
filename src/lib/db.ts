import { supabase } from './supabase'
import type { NewResult, NewWod, Wod, Result, Profile, Program } from './types'

export interface PersonalRecord {
  id: string
  user_id: string
  exercise: string
  weight: number
  achieved_at: string
  wod_id: string | null
  created_at: string
}

// ── Profiles ──────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ── WODs ──────────────────────────────────────────────

export async function getWods(): Promise<Wod[]> {
  const { data, error } = await supabase
    .from('wods')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

export async function getWodByDate(date: string): Promise<Wod | null> {
  const { data, error } = await supabase
    .from('wods')
    .select('*')
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function createWod(wod: NewWod): Promise<Wod> {
  const { data, error } = await supabase
    .from('wods')
    .insert(wod)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateWod(id: string, updates: Pick<NewWod, 'title' | 'description' | 'type'>): Promise<Wod> {
  const { data, error } = await supabase
    .from('wods')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteWod(id: string): Promise<void> {
  const { error } = await supabase.from('wods').delete().eq('id', id)
  if (error) throw error
}

export interface RankingEntry {
  id: string
  user_id: string
  score_time: string | null
  score_rounds: string | null
  score_weight: number | null
  score_notes: string | null
  rx: boolean
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

export async function getWodRanking(wodId: string): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('results')
    .select('*, profiles(full_name, avatar_url)')
    .eq('wod_id', wodId)

  if (error) throw error
  return data
}

export async function getWodsForWeek(from: string, to: string, program: Program = 'bizarro'): Promise<Wod[]> {
  const { data, error } = await supabase
    .from('wods')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .eq('program', program)
    .order('date', { ascending: true })
    .order('block', { ascending: true })

  if (error) throw error
  return data
}

export async function getWodsForWeekLibre(userId: string, from: string, to: string): Promise<Wod[]> {
  const { data, error } = await supabase
    .from('wods')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .eq('program', 'libre')
    .eq('owner_id', userId)
    .order('date', { ascending: true })
    .order('block', { ascending: true })

  if (error) throw error
  return data
}

export async function createLibreWod(wod: Omit<NewWod, 'program'>, userId: string): Promise<Wod> {
  const { data, error } = await supabase
    .from('wods')
    .insert({ ...wod, program: 'libre', owner_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Results ───────────────────────────────────────────

export async function getResultsByWod(wodId: string): Promise<Result[]> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('wod_id', wodId)

  if (error) throw error
  return data
}

export async function getMyResults(): Promise<Result[]> {
  const { data, error } = await supabase
    .from('results')
    .select('*, wods(date, title, type)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function updateProfile(userId: string, updates: { full_name: string; avatar_url: string }): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) throw error
}

export async function updateProfileProgram(userId: string, program: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ program })
    .eq('id', userId)

  if (error) throw error
}

export async function getAthletes(programSlug: string): Promise<Profile[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: program } = await supabase
    .from('programs')
    .select('id, owner_id')
    .eq('slug', programSlug)
    .single()

  if (!program) return []
  if (program.owner_id !== user.id) throw new Error('No autorizado')

  const { data: entries, error: entriesError } = await supabase
    .from('athlete_programs')
    .select('athlete_id')
    .eq('program_id', program.id)

  if (entriesError) throw entriesError
  if (!entries || entries.length === 0) return []

  const athleteIds = entries.map((e: { athlete_id: string }) => e.athlete_id)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', athleteIds)
    .order('full_name', { ascending: true })

  if (error) throw error
  return data
}

export async function getResultsForWodsAndUser(wodIds: string[], userId: string): Promise<Result[]> {
  if (wodIds.length === 0) return []

  const { data, error } = await supabase
    .from('results')
    .select('*')
    .in('wod_id', wodIds)
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export async function getResultsForWods(wodIds: string[]): Promise<Result[]> {
  if (wodIds.length === 0) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('SESSION_EXPIRED')

  const { data, error } = await supabase
    .from('results')
    .select('*')
    .in('wod_id', wodIds)
    .eq('user_id', user.id)

  if (error) throw error
  return data
}

// ── Personal Records ──────────────────────────────────

export async function getMyPRs(): Promise<PersonalRecord[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('SESSION_EXPIRED')

  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', user.id)
    .order('exercise', { ascending: true })

  if (error) throw error
  return data
}

export async function maybeUpdatePR(
  userId: string,
  exercise: string,
  weight: number,
  achievedAt: string,
  wodId: string
): Promise<{ isNewPR: boolean }> {
  // Buscar PR actual
  const { data: current } = await supabase
    .from('personal_records')
    .select('weight')
    .eq('user_id', userId)
    .eq('exercise', exercise)
    .single()

  const isNewPR = !current || weight > current.weight
  if (!isNewPR) return { isNewPR: false }

  const { error: upsertError } = await supabase
    .from('personal_records')
    .upsert({ user_id: userId, exercise, weight, achieved_at: achievedAt, wod_id: wodId }, { onConflict: 'user_id,exercise' })

  if (upsertError) return { isNewPR: false }

  return { isNewPR: true }
}

export async function saveManualPR(exercise: string, weight: number, achievedAt: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('SESSION_EXPIRED')

  const { error } = await supabase
    .from('personal_records')
    .upsert(
      { user_id: user.id, exercise, weight, achieved_at: achievedAt, wod_id: null },
      { onConflict: 'user_id,exercise' }
    )

  if (error) throw new Error(error.message)
}

// ── Athlete Programs ──────────────────────────────────

export interface AthleteProgramEntry {
  id: string
  athlete_id: string
  program_id: string
  joined_at: string
  programs: { name: string; slug: string }
}

export async function getMyAthletePrograms(userId: string): Promise<AthleteProgramEntry[]> {
  const { data, error } = await supabase
    .from('athlete_programs')
    .select('*, programs(name, slug)')
    .eq('athlete_id', userId)
  if (error) throw error
  return data
}

export async function getDiscoverPrograms(userId: string): Promise<ProgramEntry[]> {
  const { data: mine } = await supabase
    .from('athlete_programs')
    .select('program_id')
    .eq('athlete_id', userId)
  const myIds = (mine ?? []).map((r: { program_id: string }) => r.program_id)

  const { data: all, error } = await supabase
    .from('programs')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)

  return (all ?? []).filter(p => !myIds.includes(p.id))
}

// ── Join Requests ─────────────────────────────────────

export interface JoinRequest {
  id: string
  athlete_id: string
  program_id: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  profiles?: { full_name: string | null; avatar_url: string | null }
  programs?: { name: string; slug: string }
}

export async function cancelJoinRequest(athleteId: string, programId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/cancel-join-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ athleteId, programId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al cancelar solicitud')
}

export async function createJoinRequest(athleteId: string, programId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/create-join-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ athleteId, programId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al crear solicitud')
}

export async function getMyJoinRequests(userId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, programs(name, slug)')
    .eq('athlete_id', userId)
    .neq('status', 'accepted')
  if (error) throw error
  return data
}

export async function getMyAcceptedJoinRequests(userId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, programs(name, slug)')
    .eq('athlete_id', userId)
    .eq('status', 'accepted')
  if (error) throw error
  return data ?? []
}

export async function getPendingJoinRequests(programIds: string[]): Promise<JoinRequest[]> {
  if (programIds.length === 0) return []
  const { data, error } = await supabase
    .from('join_requests')
    .select('*, profiles(full_name, avatar_url), programs(name, slug)')
    .in('program_id', programIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function acceptJoinRequest(requestId: string, athleteId: string, programId: string, programSlug: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/accept-join-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ requestId, athleteId, programId, programSlug }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al aceptar solicitud')
}

export async function rejectJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('join_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
  if (error) throw error
}

// ── Programs ──────────────────────────────────────────

export interface ProgramEntry {
  id: string
  name: string
  slug: string
  owner_id: string
  created_at: string
}

export async function getMyPrograms(userId: string): Promise<ProgramEntry[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getAllPrograms(): Promise<ProgramEntry[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) throw error
}

export async function createProgram(name: string, slug: string, userId: string): Promise<ProgramEntry> {
  const { data, error } = await supabase
    .from('programs')
    .insert({ name, slug, owner_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getProgramBySlug(slug: string): Promise<{ name: string; slug: string } | null> {
  const { data } = await supabase
    .from('programs')
    .select('name, slug')
    .eq('slug', slug)
    .single()
  return data ?? null
}

export async function createCoachInvite(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('coach_invites')
    .insert({ token, created_by: userId })
  if (error) throw error
  return token
}

// Solo para coaches: expulsar a un atleta del programa
export async function removeAthleteFromProgram(athleteId: string, programId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/remove-athlete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ athleteId, programId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al quitar atleta')
}

// Para atletas: salir voluntariamente de un programa propio
export async function leaveProgram(athleteId: string, programId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/leave-program', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ athleteId, programId }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al salir del programa')
}

export async function addAthleteByEmail(email: string, programId: string, programSlug: string): Promise<Profile> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/add-athlete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ email, programId, programSlug }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al añadir atleta')
  return json.profile
}

export async function upsertResult(result: NewResult): Promise<Result> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data, error } = await supabase
    .from('results')
    .upsert({ ...result, user_id: user.id }, { onConflict: 'wod_id,user_id' })
    .select()
    .single()

  if (error) throw error
  return data
}
