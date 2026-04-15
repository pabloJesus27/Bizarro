'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

function UnirseContent() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'joining' | 'error' | 'success'>('loading')
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!token) { router.push('/elegir-modo'); return }
    if (!user || !session) {
      router.push(`/login?redirect=/unirse-comunidad?token=${token}`)
      return
    }

    setStatus('joining')

    fetch('/api/join-community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.slug) {
          setStatus('success')
          router.push(`/comunidad/${data.slug}`)
        } else {
          setStatus('error')
          setError(data.error ?? 'Error al unirse a la comunidad')
        }
      })
      .catch(() => {
        setStatus('error')
        setError('Error de conexión. Inténtalo de nuevo.')
      })
  }, [authLoading, user, session, token, router])

  return (
    <main className="min-h-dvh bg-black flex items-center justify-center px-6">
      <div className="text-center flex flex-col gap-4">
        {(status === 'loading' || status === 'joining') && (
          <div className="flex gap-1.5 justify-center">
            <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" />
          </div>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 text-xs font-mono">{error}</p>
            <button
              onClick={() => router.push('/elegir-modo')}
              className="text-neutral-500 hover:text-white text-xs font-mono uppercase tracking-widest transition"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </main>
  )
}

export default function UnirseComunidadPage() {
  return (
    <Suspense>
      <UnirseContent />
    </Suspense>
  )
}
