'use client'


import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMyPRs, saveManualPR } from '@/lib/db'
import type { PersonalRecord } from '@/lib/db'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import { getTodayStr } from '@/lib/week-utils'

const GROUPS = [
  {
    label: 'Fuerza',
    exercises: [
      'Back Squat',
      'Front Squat',
      'Overhead Squat',
      'Deadlift',
      'Bench Press',
      'Strict Press',
      'Push Press',
      'Pull Ups',
    ],
  },
  {
    label: 'Halterofilia',
    exercises: [
      'Clean',
      'Power Clean',
      'Hang Power Clean',
      'Snatch',
      'Power Snatch',
      'Hang Power Snatch',
      'Clean & Jerk',
      'Cluster',
    ],
  },
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}


export default function MaximosPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [prs,     setPrs]     = useState<PersonalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [editing,    setEditing]    = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getMyPRs()
      .then(setPrs)
      .catch(err => {
        if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
          router.push('/login')
        } else {
          setError('No se pudieron cargar los máximos.')
        }
      })
      .finally(() => setLoading(false))
  }, [authLoading, user, router])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function getPR(exercise: string): PersonalRecord | undefined {
    return prs.find(p => p.exercise.toLowerCase() === exercise.toLowerCase())
  }

  function openEdit(exercise: string) {
    const pr = getPR(exercise)
    setEditing(exercise)
    setEditWeight(pr ? String(pr.weight) : '')
    setSaveError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setEditWeight('')
    setSaveError(null)
  }

  async function handleSave(exercise: string) {
    const weight = parseFloat(editWeight)
    if (!editWeight || isNaN(weight) || weight <= 0) {
      setSaveError('Introduce un peso válido')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await saveManualPR(exercise, weight, getTodayStr())
      setPrs(prev => {
        const existing = prev.findIndex(p => p.exercise.toLowerCase() === exercise.toLowerCase())
        const updated: PersonalRecord = {
          id: prev[existing]?.id ?? '',
          user_id: prev[existing]?.user_id ?? '',
          exercise,
          weight,
          achieved_at: getTodayStr(),
          wod_id: null,
          created_at: prev[existing]?.created_at ?? getTodayStr(),
        }
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = updated
          return next
        }
        return [...prev, updated]
      })
      setEditing(null)
      setEditWeight('')
    } catch {
      setSaveError('No se pudo guardar. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <AthletePageLoading />
    )
  }

  return (
    <main className="min-h-dvh bg-black flex flex-col">

      <AppHeader />

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

        {error && (
          <p className="text-red-400 text-sm text-center py-4">{error}</p>
        )}

        {GROUPS.map(group => (
          <div key={group.label} className="mb-10">
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-4">
              {group.label}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {group.exercises.map(exercise => {
                const pr = getPR(exercise)
                const isEditing = editing === exercise
                return (
                  <div
                    key={exercise}
                    onClick={() => { if (!isEditing) openEdit(exercise) }}
                    className={`flex flex-col justify-between border rounded-xl px-4 py-4 bg-neutral-950 transition ${isEditing ? 'border-white' : 'border-neutral-700 cursor-pointer hover:border-neutral-500'}`}
                  >
                    <p className="text-neutral-300 text-xs font-mono uppercase tracking-tight leading-tight mb-3">
                      {exercise}
                    </p>

                    {isEditing ? (
                      <div onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 mb-2">
                          <input
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            value={editWeight}
                            onChange={e => setEditWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(exercise); if (e.key === 'Escape') cancelEdit() }}
                            placeholder="0"
                            className="w-full bg-black text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-2 py-1 focus:outline-none focus:border-white tabular-nums"
                          />
                          <p className="text-neutral-500 text-xs font-mono shrink-0">kg</p>
                        </div>
                        {saveError && <p className="text-red-400 text-xs font-mono mb-2">{saveError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(exercise)}
                            disabled={saving}
                            className="flex-1 bg-white text-black text-xs font-black uppercase tracking-widest py-1 rounded-lg disabled:opacity-50"
                          >
                            {saving ? '...' : 'OK'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex-1 border border-neutral-700 text-neutral-400 text-xs font-mono uppercase py-1 rounded-lg hover:border-neutral-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className={`font-black text-2xl leading-none ${pr ? 'text-white' : 'text-neutral-500'}`}>
                          {pr ? `${pr.weight} kg` : '—'}
                        </p>
                        {pr ? (
                          <p className="text-neutral-400 text-xs font-mono mt-1">{formatDate(pr.achieved_at)}</p>
                        ) : (
                          <p className="text-neutral-500 text-xs font-mono mt-1">kg</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

      </div>
    </main>
  )
}
