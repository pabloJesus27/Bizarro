'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { updatePassword } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { getProfile } from '@/lib/db'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('Mínimo 6 caracteres')
      return
    }
    setError('')
    setLoading(true)
    try {
      await updatePassword(password)
      const profile = user ? await getProfile(user.id) : null
      router.push(profile?.role === 'coach' ? '/select-program' : '/dashboard')
    } catch (err: unknown) {
      setError('No se pudo actualizar la contraseña. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image
            src="/logoBizarro.png"
            alt="Bizarro"
            width={180}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center mb-6">
          Nueva contraseña
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />
          <input
            type="password"
            placeholder="Repetir contraseña"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            required
            className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-black uppercase tracking-widest rounded-lg px-4 py-3 hover:bg-neutral-200 disabled:opacity-50 transition"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
