'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import {
  getMyAthletePrograms,
  getDiscoverPrograms,
  getMyJoinRequests,
  getMyAcceptedJoinRequests,
  createJoinRequest,
  cancelJoinRequest,
  leaveProgram,
} from '@/lib/db'
import type { AthleteProgramEntry, ProgramEntry, JoinRequest } from '@/lib/db'
import AppHeader from '@/components/AppHeader'

const slugImages: Record<string, string> = {
  bizarro: '/logoBizarro.png',
  entrenemos: '/entrenemos.png',
}

const SEEN_KEY_PREFIX = 'accepted_seen_'

function getSeenKey(requestId: string): string {
  return `${SEEN_KEY_PREFIX}${requestId}`
}

function markAsSeen(requestId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(getSeenKey(requestId), 'true')
  }
}

function isSeen(requestId: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(getSeenKey(requestId)) === 'true'
}

export default function ProgramacionesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [myPrograms,             setMyPrograms]             = useState<AthleteProgramEntry[]>([])
  const [discover,               setDiscover]               = useState<ProgramEntry[]>([])
  const [joinRequests,           setJoinRequests]           = useState<JoinRequest[]>([])
  const [acceptedNotifications,  setAcceptedNotifications]  = useState<JoinRequest[]>([])
  const [loading,                setLoading]                = useState(true)
  const [requesting,             setRequesting]             = useState<string | null>(null)
  const [cancelling,             setCancelling]             = useState<string | null>(null)
  const [leaving,                setLeaving]                = useState<string | null>(null)
  const [confirmLeave,           setConfirmLeave]           = useState<string | null>(null)
  const [tab,                    setTab]                    = useState<'mis' | 'descubrir'>('mis')
  const [error,                  setError]                  = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    Promise.all([
      getMyAthletePrograms(user.id),
      getDiscoverPrograms(user.id),
      getMyJoinRequests(user.id),
      getMyAcceptedJoinRequests(user.id),
    ]).then(([mine, disc, reqs, accepted]) => {
      setMyPrograms(mine)
      setDiscover(disc)
      setJoinRequests(reqs)
      const unseen = accepted.filter(r => r.id && !isSeen(r.id))
      setAcceptedNotifications(unseen)
      setLoading(false)
    }).catch(() => {
      setError('Error al cargar los programas. Recarga la página.')
      setLoading(false)
    })
  }, [authLoading, user, router])

  function dismissNotification(requestId: string): void {
    markAsSeen(requestId)
    setAcceptedNotifications(prev => prev.filter(n => n.id !== requestId))
  }

  async function handleRequest(program: ProgramEntry) {
    if (!user) return
    setRequesting(program.id)
    try {
      await createJoinRequest(user.id, program.id)
      setJoinRequests(prev => [...prev, {
        id: '',
        athlete_id: user.id,
        program_id: program.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        programs: { name: program.name, slug: program.slug },
      }])
    } catch {
      setError('No se pudo enviar la solicitud. Inténtalo de nuevo.')
    } finally {
      setRequesting(null)
    }
  }

  async function handleLeave(ap: AthleteProgramEntry) {
    if (!user) return
    setLeaving(ap.program_id)
    try {
      await leaveProgram(user.id, ap.program_id)
      setMyPrograms(prev => prev.filter(p => p.program_id !== ap.program_id))
      setDiscover(prev => [...prev, { id: ap.program_id, name: ap.programs.name, slug: ap.programs.slug, owner_id: '', created_at: '' }])
      setConfirmLeave(null)
    } catch {
      setError('No se pudo salir del programa. Inténtalo de nuevo.')
    } finally {
      setLeaving(null)
    }
  }

  async function handleCancel(program: ProgramEntry) {
    if (!user) return
    setCancelling(program.id)
    try {
      await cancelJoinRequest(user.id, program.id)
      setJoinRequests(prev => prev.filter(r => r.program_id !== program.id))
    } catch {
      setError('No se pudo cancelar la solicitud. Inténtalo de nuevo.')
    } finally {
      setCancelling(null)
    }
  }

  function getRequestStatus(programId: string): 'pending' | 'accepted' | 'rejected' | null {
    return joinRequests.find(r => r.program_id === programId)?.status ?? null
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <AppHeader />

      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

        {/* Accepted join request notifications */}
        {acceptedNotifications.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {acceptedNotifications.map(notification => {
              const programName = notification.programs?.name ?? 'tu programa'
              const programSlug = notification.programs?.slug ?? ''
              return (
                <div
                  key={notification.id}
                  className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-green-400 text-lg">✓</span>
                    <p className="text-white text-sm">
                      ¡Tu solicitud al programa <strong>{programName}</strong> fue aceptada!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/dashboard?program=${programSlug}`)}
                      className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Ir al programa →
                    </button>
                    <button
                      onClick={() => dismissNotification(notification.id)}
                      className="text-white/40 hover:text-white transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-950 border border-red-800 rounded-xl">
            <p className="text-red-400 text-xs font-mono">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-900 rounded-full p-1 w-fit mb-10">
          <button
            onClick={() => setTab('mis')}
            className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${tab === 'mis' ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Mis programaciones
          </button>
          <button
            onClick={() => setTab('descubrir')}
            className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${tab === 'descubrir' ? 'bg-white text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Descubrir
          </button>
        </div>

        {tab === 'mis' && (
          <>
            {myPrograms.length === 0 ? (
              <div className="flex flex-col justify-center pt-8">
                <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-3">Programaciones</p>
                <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">Sin programas</h2>
                <p className="text-neutral-700 text-sm font-mono mt-4">Ve a Descubrir para unirte a uno.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {myPrograms.map(ap => {
                  const img = slugImages[ap.programs.slug]
                  return (
                    <div
                      key={ap.id}
                      className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-900"
                    >
                      {img ? (
                        <Image src={img} alt={ap.programs.name} width={36} height={36} className="object-contain" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center">
                          <span className="text-white font-black text-sm uppercase">{ap.programs.name[0]}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-black text-sm uppercase tracking-tight">{ap.programs.name}</p>
                        <p className="text-neutral-600 text-xs font-mono">
                          Desde {new Date(ap.joined_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmLeave(ap.program_id)}
                        className="text-neutral-600 hover:text-red-400 text-xs font-mono uppercase tracking-widest border border-neutral-800 hover:border-red-400 rounded-full px-3 py-1 transition"
                      >
                        Salir
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'descubrir' && (
          <>
            {discover.length === 0 ? (
              <div className="flex flex-col justify-center pt-8">
                <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">Ya estás en todos</h2>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {discover.map(program => {
                  const img    = slugImages[program.slug]
                  const status = getRequestStatus(program.id)
                  return (
                    <div
                      key={program.id}
                      className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-900"
                    >
                      {img ? (
                        <Image src={img} alt={program.name} width={36} height={36} className="object-contain" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center">
                          <span className="text-white font-black text-sm uppercase">{program.name[0]}</span>
                        </div>
                      )}
                      <p className="flex-1 text-white font-black text-sm uppercase tracking-tight">{program.name}</p>

                      {status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500 text-xs font-mono uppercase tracking-widest">Pendiente</span>
                          <button
                            onClick={() => handleCancel(program)}
                            disabled={cancelling === program.id}
                            className="text-xs font-mono uppercase tracking-widest text-neutral-600 hover:text-red-400 border border-neutral-800 hover:border-red-400 rounded-full px-3 py-1 transition disabled:opacity-50"
                          >
                            {cancelling === program.id ? '...' : 'Cancelar'}
                          </button>
                        </div>
                      )}
                      {(status === null || status === 'rejected') && (
                        <button
                          onClick={() => handleRequest(program)}
                          disabled={requesting === program.id}
                          className="text-xs font-mono uppercase tracking-widest text-neutral-400 hover:text-white border border-neutral-700 hover:border-white rounded-full px-4 py-1.5 transition disabled:opacity-50"
                        >
                          {requesting === program.id ? '...' : 'Solicitar'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      {confirmLeave && (() => {
        const ap = myPrograms.find(p => p.program_id === confirmLeave)
        if (!ap) return null
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-6">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm">
              <p className="text-white font-black text-lg uppercase tracking-tight mb-1">Salir del programa</p>
              <p className="text-neutral-500 text-sm font-mono mb-6">
                ¿Quieres salir de <span className="text-white">{ap.programs.name}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmLeave(null)}
                  disabled={leaving === confirmLeave}
                  className="flex-1 border border-neutral-800 text-neutral-500 hover:text-white font-mono text-xs uppercase tracking-widest rounded-full py-2.5 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleLeave(ap)}
                  disabled={leaving === confirmLeave}
                  className="flex-1 bg-red-500 hover:bg-red-400 text-white font-black text-xs uppercase tracking-widest rounded-full py-2.5 transition disabled:opacity-50"
                >
                  {leaving === confirmLeave ? '...' : 'Salir'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </main>
  )
}
