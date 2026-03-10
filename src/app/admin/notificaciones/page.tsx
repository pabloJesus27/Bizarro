'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getMyPrograms, getPendingJoinRequests, acceptJoinRequest, rejectJoinRequest } from '@/lib/db'
import type { JoinRequest } from '@/lib/db'

const slugImages: Record<string, string> = {
  bizarro: '/logoBizarro.png',
  entrenemos: '/entrenemos.png',
}

export default function NotificacionesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const programSlug = searchParams.get('program') ?? 'bizarro'

  const [requests,  setRequests]  = useState<JoinRequest[]>([])
  const [loading,   setLoading]   = useState(true)
  const [acting,    setActing]    = useState<string | null>(null)
  const [programName, setProgramName] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(async profile => {
      if (profile?.role !== 'coach') { router.push('/dashboard'); return }

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
      await acceptJoinRequest(req.id, req.athlete_id, req.program_id)
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
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  const img = slugImages[programSlug]

  return (
    <main className="min-h-screen bg-black flex flex-col">

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
        <div className="flex items-center gap-3">
          {img
            ? <Image src={img} alt={programName} width={48} height={48} className="object-contain" />
            : <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"><span className="text-white font-black text-sm uppercase">{programSlug[0]}</span></div>
          }
          <span className="text-white font-black text-xl tracking-tighter">{programName.toUpperCase()}</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 rounded-full p-1">
          <button
            onClick={() => router.push(`/admin?program=${programSlug}`)}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
          >
            Home
          </button>
          <button
            onClick={() => router.push(`/admin/atletas?program=${programSlug}`)}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
          >
            Mis atletas
          </button>
          <button
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition bg-white text-black relative"
          >
            Notificaciones
            {requests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-black">
                {requests.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => router.push('/select-program')}
          className="text-neutral-600 hover:text-white text-xs font-mono transition uppercase tracking-widest"
        >
          ← Programas
        </button>
      </header>

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
              <div key={req.id} className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-900">
                {req.profiles?.avatar_url ? (
                  <Image src={req.profiles.avatar_url} alt="" width={40} height={40} className="rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white text-xs font-black">
                      {req.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white font-black text-sm">{req.profiles?.full_name ?? 'Atleta'}</p>
                  <p className="text-neutral-600 text-xs font-mono">
                    Quiere unirse a <span className="text-neutral-400">{req.programs?.name}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={acting === req.id}
                    className="bg-white text-black font-black uppercase text-xs rounded-full px-4 py-1.5 hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={acting === req.id}
                    className="border border-neutral-700 text-neutral-400 hover:text-white font-mono text-xs rounded-full px-4 py-1.5 transition disabled:opacity-50"
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
