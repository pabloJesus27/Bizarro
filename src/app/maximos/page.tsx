'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getMyPRs } from '@/lib/db'
import type { PersonalRecord } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
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

  return (
    <main className="min-h-screen bg-black flex flex-col">

      <AppHeader />

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

        {prs.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center pt-16">
            <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-3">Sin registros</p>
            <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">
              Aún no tienes máximos
            </h2>
            <p className="text-neutral-700 text-sm font-mono mt-4">
              Se registran automáticamente al guardar un resultado de tipo Strength.
            </p>
          </div>
        ) : (
          <>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-6">
              {prs.length} {prs.length === 1 ? 'ejercicio' : 'ejercicios'}
            </p>

            <div className="flex flex-col gap-3">
              {prs.map((pr, i) => (
                <div
                  key={pr.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-900"
                >
                  <span className="text-neutral-700 font-mono text-xs w-5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-black text-base uppercase tracking-tight">{pr.exercise}</p>
                    <p className="text-neutral-600 text-xs font-mono mt-0.5">{formatDate(pr.achieved_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-black text-xl">{pr.weight}</p>
                    <p className="text-neutral-600 text-xs font-mono">kg</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
