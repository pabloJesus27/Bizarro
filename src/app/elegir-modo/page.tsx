'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getMyAthletePrograms, updateProfileProgram } from '@/lib/db'
import type { AthleteProgramEntry } from '@/lib/db'

const slugImages: Record<string, string> = {
  bizarro: '/logoBizarro.png',
  entrenemos: '/entrenemos.png',
}

export default function ElegirModoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [programs,     setPrograms]     = useState<AthleteProgramEntry[]>([])
  const [ready,        setReady]        = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) { router.push('/login'); return }

    setError(null)
    setReady(false)

    try {
      const profile = await getProfile(user.id)
      if (!profile) { router.push('/login'); return }
      if (profile.role === 'coach') { router.push('/select-program'); return }

      const myPrograms = await getMyAthletePrograms(user.id)
      setPrograms(myPrograms)
      setReady(true)
    } catch {
      setError('No se pudieron cargar tus programas. Inténtalo de nuevo.')
    }
  }, [user, router])

  useEffect(() => {
    if (loading) return
    loadData()
  }, [loading, loadData])

  if (!ready) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        {error ? (
          <div className="text-center flex flex-col gap-4">
            <p className="text-red-400 text-xs font-mono">{error}</p>
            <button
              onClick={loadData}
              className="text-neutral-500 hover:text-white text-xs font-mono uppercase tracking-widest transition"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="w-px h-10 bg-white animate-pulse" />
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-12">
      <div className="text-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-3">¿Cómo quieres entrenar hoy?</p>
        <h1 className="text-white font-black text-3xl uppercase tracking-tighter">Elige tu modo</h1>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-6 w-full max-w-2xl justify-center items-center">

        {programs.map(ap => {
          const slug = ap.programs.slug
          const name = ap.programs.name
          const img  = slugImages[slug]
          return (
            <button
              key={ap.id}
              disabled={isNavigating}
              onClick={async () => {
                setIsNavigating(true)
                try {
                  if (user) await updateProfileProgram(user.id, slug)
                  router.push(`/dashboard?program=${slug}`)
                } catch {
                  setError('No se pudo seleccionar el programa. Inténtalo de nuevo.')
                  setIsNavigating(false)
                }
              }}
              className="group flex-1 min-w-[160px] max-w-[200px] border border-neutral-800 hover:border-white rounded-2xl p-8 flex flex-col items-center gap-5 transition-colors disabled:opacity-50"
            >
              {img ? (
                <Image src={img} alt={name} width={56} height={56} className="object-contain" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center">
                  <span className="text-white font-black text-2xl uppercase">{name[0]}</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-white font-black text-sm uppercase tracking-tight">{name}</p>
                <p className="text-neutral-600 text-xs font-mono mt-1">WODs de mi coach</p>
              </div>
              <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
                Entrar →
              </span>
            </button>
          )
        })}

        {/* Por libre */}
        <button
          disabled={isNavigating}
          onClick={async () => {
            setIsNavigating(true)
            try {
              if (user) await updateProfileProgram(user.id, 'libre')
              router.push('/libre')
            } catch {
              setError('No se pudo seleccionar el modo libre. Inténtalo de nuevo.')
              setIsNavigating(false)
            }
          }}
          className="group flex-1 min-w-[160px] max-w-[200px] border border-neutral-800 hover:border-white rounded-2xl p-8 flex flex-col items-center gap-5 transition-colors disabled:opacity-50"
        >
          <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center">
            <span className="text-white font-black text-2xl">✦</span>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-sm uppercase tracking-tight">Por libre</p>
            <p className="text-neutral-600 text-xs font-mono mt-1">Mis propios WODs</p>
          </div>
          <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
            Entrar →
          </span>
        </button>

      </div>
    </main>
  )
}
