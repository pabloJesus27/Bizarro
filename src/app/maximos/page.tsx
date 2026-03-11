'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMyPRs } from '@/lib/db'
import type { PersonalRecord } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

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

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getMyPRs()
      .then(setPrs)
      .finally(() => setLoading(false))
  }, [authLoading, user, router])

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  function getPR(exercise: string): PersonalRecord | undefined {
    return prs.find(p => p.exercise.toLowerCase() === exercise.toLowerCase())
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">

      <AppHeader />

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

        {GROUPS.map(group => (
          <div key={group.label} className="mb-10">
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-4">
              {group.label}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {group.exercises.map(exercise => {
                const pr = getPR(exercise)
                return (
                  <div
                    key={exercise}
                    className="flex flex-col justify-between border border-neutral-700 rounded-xl px-4 py-4 bg-neutral-950"
                  >
                    <p className="text-neutral-300 text-xs font-mono uppercase tracking-tight leading-tight mb-3">
                      {exercise}
                    </p>
                    <div>
                      <p className={`font-black text-2xl leading-none ${pr ? 'text-white' : 'text-neutral-500'}`}>
                        {pr ? pr.weight : '—'}
                      </p>
                      {pr ? (
                        <p className="text-neutral-400 text-xs font-mono mt-1">{formatDate(pr.achieved_at)}</p>
                      ) : (
                        <p className="text-neutral-500 text-xs font-mono mt-1">kg</p>
                      )}
                    </div>
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
