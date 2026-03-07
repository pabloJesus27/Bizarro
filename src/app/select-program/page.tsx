'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile } from '@/lib/db'

export default function SelectProgramPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      if (profile?.role !== 'coach') router.push('/dashboard')
    })
  }, [loading, user, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-12">
      <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono">
        Selecciona el programa
      </p>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl">

        {/* Bizarro */}
        <button
          onClick={() => router.push('/admin')}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors"
        >
          <Image
            src="/logoBizarro.png"
            alt="Bizarro"
            width={120}
            height={60}
            className="object-contain"
          />
          <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
            Entrar →
          </span>
        </button>

        {/* Entrenemos */}
        <button
          onClick={() => router.push('/entrenemos')}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors"
        >
          <Image
            src="/entrenemos.png"
            alt="Entrenemos"
            width={120}
            height={60}
            className="object-contain"
          />
          <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
            Entrar →
          </span>
        </button>

      </div>
    </main>
  )
}
