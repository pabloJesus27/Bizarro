'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { updateProfileProgram } from '@/lib/db'
import { supabase } from '@/lib/supabase'

export default function ElegirProgramaPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Si el usuario eligió programa al registrarse, aplicarlo automáticamente
  useEffect(() => {
    if (loading || !user) return

    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata
      const program = meta?.program ?? null

      if (program && program !== 'libre') {
        // Tenía programa elegido → aplicar y redirigir al dashboard
        updateProfileProgram(user.id, program).then(() => router.push('/dashboard'))
      } else if (program === null || program === undefined) {
        // No eligió nada → es libre (puede haber llegado aquí por un flujo antiguo)
        // Mostrar pantalla manual
      } else {
        // program === 'libre'
        updateProfileProgram(user.id, 'libre').then(() => router.push('/libre'))
      }
    })
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  async function handleSelect(program: 'bizarro' | 'entrenemos' | 'libre') {
    if (!user || saving) return
    setSaving(true)
    try {
      await updateProfileProgram(user.id, program)
      router.push(program === 'libre' ? '/libre' : '/dashboard')
    } catch {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-black flex items-center justify-center">
        <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-black flex flex-col items-center justify-center px-6 gap-12">
      <div className="text-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-3">Bienvenido</p>
        <h1 className="text-white font-black text-3xl uppercase tracking-tighter">¿A qué box perteneces?</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl">

        <button
          onClick={() => handleSelect('bizarro')}
          disabled={saving}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors disabled:opacity-50"
        >
          <Image src="/logoBizarro.png" alt="Bizarro" width={120} height={60} className="object-contain" />
          <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
            Entrar →
          </span>
        </button>

        <button
          onClick={() => handleSelect('entrenemos')}
          disabled={saving}
          className="flex-1 group border border-neutral-800 rounded-2xl p-8 flex flex-col items-center gap-6 hover:border-white transition-colors disabled:opacity-50"
        >
          <Image src="/entrenemos.png" alt="Entrenemos" width={120} height={60} className="object-contain" />
          <span className="text-neutral-600 text-xs uppercase tracking-widest font-mono group-hover:text-white transition-colors">
            Entrar →
          </span>
        </button>

      </div>

      <button
        onClick={() => handleSelect('libre')}
        disabled={saving}
        className="text-neutral-600 hover:text-white text-sm font-mono transition disabled:opacity-50"
      >
        Voy por libre →
      </button>
    </main>
  )
}
