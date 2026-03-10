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

export async function getAthletes(program: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'athlete')
    .eq('program', program)
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
  if (!user) return []

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
  if (!user) return []

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

  await supabase
    .from('personal_records')
    .upsert({ user_id: userId, exercise, weight, achieved_at: achievedAt, wod_id: wodId }, { onConflict: 'user_id,exercise' })

  return { isNewPR: true }
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

export async function createCoachInvite(userId: string): Promise<string> {
  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('coach_invites')
    .insert({ token, created_by: userId })
  if (error) throw error
  return token
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
