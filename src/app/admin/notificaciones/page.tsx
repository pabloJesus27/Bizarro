'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getMyPrograms, getPendingJoinRequests, acceptJoinRequest, rejectJoinRequest } from '@/lib/db'
import type { JoinRequest } from '@/lib/db'
import CoachHeader from '@/components/CoachHeader'
import { CoachPageLoading } from '@/components/PageLoading'

function NotificacionesContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const programSlug = searchParams.get('program') ?? 'bizarro'

  const [requests,    setRequests]    = useState<JoinRequest[]>([])
  const [loading,     setLoading]     = useState(true)
  const [acting,      setActing]      = useState<string | null>(null)
  const [programName, setProgramName] = useState('')
  const [profileName, setProfileName] = useState('')
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(async profile => {
      if (profile?.role !== 'coach') { router.push('/dashboard'); return }

      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)

      const programs = await getMyPrograms(user.id)
      const current = programs.find(p => p.slug === programSlug)
      if (current) setProgramName(current.name)

      const programIds = programs.map(p => p.id)
      const reqs = await getPendingJoinRequests(programIds)
      setRequests(reqs)
      setLoading(false)
    })
  }, [authLoading, user, router, programSlug])

  async function handleAccept(req: JoinRequest) {
    setActing(req.id)
    try {
      await acceptJoinRequest(req.id, req.athlete_id, req.program_id, req.programs?.slug ?? '')
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } finally {
      setActing(null)
    }
  }

  async function handleReject(req: JoinRequest) {
    setActing(req.id)
    try {
      await rejectJoinRequest(req.id)
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } finally {
      setActing(null)
    }
  }

  if (authLoading || loading) {
    return (
      <CoachPageLoading />
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">

      {/* Header */}
      <CoachHeader
        activeTab="notificaciones"
        pendingCount={requests.length}
        programSlug={programSlug}
        programName={programName}
        profileName={profileName}
        avatarUrl={avatarUrl}
      />

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-6">
          Solicitudes pendientes
        </p>

        {requests.length === 0 ? (
          <div className="flex flex-col justify-center pt-8">
            <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">Sin solicitudes</h2>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map(req => (
              <div key={req.id} className="flex flex-col gap-3 px-5 py-4 rounded-xl border border-neutral-900 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {req.profiles?.avatar_url ? (
                    <Image src={req.profiles.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-black">
                        {req.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-black text-sm">{req.profiles?.full_name ?? 'Atleta'}</p>
                    <p className="text-neutral-600 text-xs font-mono">
                      Quiere unirse a <span className="text-neutral-400">{req.programs?.name}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={acting === req.id}
                    className="flex-1 sm:flex-none bg-white text-black font-black uppercase text-xs rounded-full px-4 py-2 hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={acting === req.id}
                    className="flex-1 sm:flex-none border border-neutral-700 text-neutral-400 hover:text-white font-mono text-xs rounded-full px-4 py-2 transition disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default function NotificacionesPage() {
  return (
    <Suspense>
      <NotificacionesContent />
    </Suspense>
  )
}
