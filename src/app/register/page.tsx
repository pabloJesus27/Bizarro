'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'
import { getAllPrograms } from '@/lib/db'
import type { ProgramEntry } from '@/lib/db'

function RegisterContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const inviteToken  = searchParams.get('invite')

  const [fullName,        setFullName]        = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [search,          setSearch]          = useState('')
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [dropdownOpen,    setDropdownOpen]    = useState(false)
  const [programs,        setPrograms]        = useState<ProgramEntry[]>([])

  useEffect(() => {
    getAllPrograms().then(setPrograms).catch(() => {})
  }, [])
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [success,         setSuccess]         = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = programs.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedLabel = programs.find(p => p.slug === selectedProgram)?.name ?? null

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
          body: JSON.stringify({ email, action: 'register' }),
        })
        const rlResult = await rlRes.json()
        if (rlRes.ok && rlResult.allowed === false) {
          setError(rlResult.error ?? 'Demasiados intentos. Por favor espera antes de volver a intentarlo.')
          return
        }
      } catch {
        // fail-open
      }

      const data = await signUp(email, password, fullName, inviteToken ? null : (selectedProgram ?? 'libre'))

      if (inviteToken && data.user) {
        const res = await fetch('/api/use-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.session?.access_token}` },
          body: JSON.stringify({ token: inviteToken }),
        })
        const result = await res.json()
        if (result.error) { setError(result.error); setLoading(false); return }
      }

      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('already registered') || msg.includes('user already exists')) {
        setError('Ya existe una cuenta con ese email.')
      } else if (msg.includes('password') && msg.includes('short')) {
        setError('La contraseña es demasiado corta.')
      } else {
        setError('No se pudo crear la cuenta. Inténtalo de nuevo.')
      }
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

          {/* Program selector — oculto si es invitación de coach */}
          {inviteToken && (
            <div className="border border-neutral-800 rounded-lg px-4 py-3">
              <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Cuenta de coach</p>
              <p className="text-white text-sm font-mono mt-0.5">Acceso por invitación</p>
            </div>
          )}

          {!inviteToken && <div ref={dropdownRef} className="relative">
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-2 font-mono">
              Elige un programa de entrenamiento (opcional)
            </label>
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              className="w-full bg-neutral-900 text-left border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition flex items-center justify-between"
            >
              <span className={selectedLabel ? 'text-white' : 'text-neutral-500'}>
                {selectedLabel ?? 'Sin programa — voy por libre'}
              </span>
              <span className="text-neutral-600 text-xs">▾</span>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="p-2 border-b border-neutral-800">
                  <input
                    type="text"
                    placeholder="Buscar programa..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-neutral-900 text-white placeholder-neutral-600 text-sm px-3 py-2 rounded-lg focus:outline-none border border-neutral-700 focus:border-white transition"
                    autoFocus
                  />
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => { setSelectedProgram(null); setDropdownOpen(false); setSearch('') }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-mono transition ${
                      selectedProgram === null ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                    }`}
                  >
                    Sin programa — voy por libre
                  </button>
                  {filtered.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedProgram(p.slug); setDropdownOpen(false); setSearch('') }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-mono transition ${
                        selectedProgram === p.slug ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="px-4 py-3 text-neutral-600 text-sm font-mono">Sin resultados</p>
                  )}
                </div>
              </div>
            )}
          </div>}

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

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}
