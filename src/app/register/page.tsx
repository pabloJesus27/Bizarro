'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signUp(email, password, fullName)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Revisa tu email</h2>
          <p className="text-neutral-400">
            Te enviamos un enlace de confirmación a <span className="text-white">{email}</span>
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 text-sm text-neutral-500 hover:text-white transition"
          >
            Volver al login →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white mb-8 text-center tracking-tight">
          Bizarro
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre completo"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />
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
            placeholder="Contraseña (mín. 6 caracteres)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
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
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-neutral-500 text-sm text-center mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-white hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
