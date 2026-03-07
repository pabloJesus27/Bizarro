'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { updateProfileProgram } from '@/lib/db'

export default function ElegirProgramaPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  async function handleSelect(program: 'bizarro' | 'entrenemos') {
    if (!user || saving) return
    setSaving(true)
    try {
      await updateProfileProgram(user.id, program)
      router.push('/dashboard')
    } catch {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 gap-12">
      <div className="text-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-3">Bienvenido</p>
        <h1 className="text-white font-black text-3xl uppercase tracking-tighter">¿A qué box perteneces?</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl">

        {/* Bizarro */}
        <button
          onClick={() => handleSelect('bizarro')}
          disabled={saving}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors disabled:opacity-50"
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
          onClick={() => handleSelect('entrenemos')}
          disabled={saving}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors disabled:opacity-50"
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
