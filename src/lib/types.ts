export type WodType = 'For Time' | 'AMRAP' | 'EMOM' | 'Strength' | 'Gymnastics' | 'Warmup' | 'For Max' | 'Other'
export type Program  = 'bizarro' | 'entrenemos' | 'libre'

export interface Wod {
  id: string
  date: string          // 'YYYY-MM-DD'
  title: string
  description: string
  type: WodType
  block: number         // 1-10
  program: Program
  owner_id: string | null
  created_at: string
}

export interface Result {
  id: string
  wod_id: string
  user_id: string
  score_time: string | null    // '14:32'
  score_rounds: string | null  // '7+15'
  score_weight: number | null  // 102.5
  score_notes: string | null
  rx: boolean
  created_at: string
}

export type NewWod = Omit<Wod, 'id' | 'created_at' | 'owner_id'> & { owner_id?: string | null }
export type NewResult = Omit<Result, 'id' | 'user_id' | 'created_at'>

export interface Profile {
  id: string
  full_name: string | null
  role: string
  avatar_url: string | null
  program: string | null
  email?: string | null
  updated_at: string
}
