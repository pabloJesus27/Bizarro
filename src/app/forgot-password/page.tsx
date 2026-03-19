'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { resetPasswordRequest } from '@/lib/auth'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Rate limit pre-check
      try {
        const rlRes = await fetch('/api/auth/check-rate-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, action: 'reset_password' }),
        })
        const rlResult = await rlRes.json()
        if (rlRes.ok && rlResult.allowed === false) {
          setError(rlResult.error ?? 'Demasiados intentos. Por favor espera antes de volver a intentarlo.')
          return
        }
      } catch {
        // fail-open
      }

      await resetPasswordRequest(email)
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el email')
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

        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-white font-black text-xl uppercase tracking-tight">Revisa tu email</p>
            <p className="text-neutral-500 text-sm font-mono">
              Te hemos enviado un enlace para restablecer tu contraseña.
            </p>
            <Link href="/login" className="text-neutral-500 text-sm hover:text-white transition font-mono mt-2">
              ← Volver al login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center mb-6">
              Recuperar contraseña
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
              />

              {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="bg-white text-black font-black uppercase tracking-widest rounded-lg px-4 py-3 hover:bg-neutral-200 disabled:opacity-50 transition"
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>

            <p className="text-neutral-500 text-sm text-center mt-6">
              <Link href="/login" className="text-neutral-600 hover:text-white transition font-mono">
                ← Volver al login
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
