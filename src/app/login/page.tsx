'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { signIn } from '@/lib/auth'
import { getProfile } from '@/lib/db'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await signIn(email, password)
      const profile = await getProfile(data.user!.id)
      if (profile?.role === 'coach') {
        router.push('/select-program')
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
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
            className="object-contain animate-coin"
            priority
          />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-semibold rounded-lg px-4 py-3 hover:bg-neutral-200 disabled:opacity-50 transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-neutral-500 text-sm text-center mt-6">
          ¿Sin cuenta?{' '}
          <Link href="/register" className="text-white hover:underline">
            Regístrate
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link href="/forgot-password" className="text-neutral-600 hover:text-white text-xs font-mono transition">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
    </main>
  )
}
