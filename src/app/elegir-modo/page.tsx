'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getMyAthletePrograms } from '@/lib/db'
import type { AthleteProgramEntry } from '@/lib/db'

const slugImages: Record<string, string> = {
  bizarro: '/logoBizarro.png',
  entrenemos: '/entrenemos.png',
}

export default function ElegirModoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [programs, setPrograms] = useState<AthleteProgramEntry[]>([])
  const [ready,    setReady]    = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(async profile => {
      if (!profile) { router.push('/login'); return }
      if (profile.role === 'coach') { router.push('/select-program'); return }

      const myPrograms = await getMyAthletePrograms(user.id)
      setPrograms(myPrograms)
      setReady(true)
    })
  }, [loading, user, router])

  if (!ready) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-12">
      <div className="text-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-3">¿Cómo quieres entrenar hoy?</p>
        <h1 className="text-white font-black text-3xl uppercase tracking-tighter">Elige tu modo</h1>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-6 w-full max-w-2xl justify-center">

        {programs.map(ap => {
          const slug = ap.programs.slug
          const name = ap.programs.name
          const img  = slugImages[slug]
          return (
            <button
              key={ap.id}
              onClick={() => router.push(`/dashboard?program=${slug}`)}
              className="group flex-1 min-w-[160px] max-w-[200px] border border-neutral-800 hover:border-white rounded-2xl p-8 flex flex-col items-center gap-5 transition-colors"
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
          onClick={() => router.push('/libre')}
          className="group flex-1 min-w-[160px] max-w-[200px] border border-neutral-800 hover:border-white rounded-2xl p-8 flex flex-col items-center gap-5 transition-colors"
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
