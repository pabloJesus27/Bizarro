'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getAthletes, getWodsForWeek, getResultsForWodsAndUser, getMyPrograms, getPendingJoinRequests, addAthleteByEmail, removeAthleteFromProgram } from '@/lib/db'
import type { Wod, Result, WodType, Profile } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL, getScoreDisplay } from '@/lib/wod-utils'
import CoachHeader from '@/components/CoachHeader'
import { CoachPageLoading } from '@/components/PageLoading'
import HelpModal, { HelpButton } from '@/components/HelpModal'
import { useFirstVisit } from '@/hooks/useFirstVisit'

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Athlete List ───────────────────────────────────────

function AthleteList({ athletes, onSelect, programId, programSlug, onAthleteAdded, onOpenHelp }: {
  athletes: Profile[]
  onSelect: (athlete: Profile) => void
  programId: string
  programSlug: string
  onAthleteAdded: (athlete: Profile) => void
  onOpenHelp?: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [email,     setEmail]     = useState('')
  const [adding,    setAdding]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleAdd() {
    if (!email.trim()) return
    setAdding(true)
    setError(null)
    try {
      const profile = await addAthleteByEmail(email.trim(), programId, programSlug)
      onAthleteAdded(profile)
      setShowModal(false)
      setEmail('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al añadir atleta')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">
            {athletes.length === 0 ? 'Sin atletas' : `${athletes.length} ${athletes.length === 1 ? 'atleta' : 'atletas'}`}
          </p>
          {onOpenHelp && <HelpButton onClick={onOpenHelp} />}
        </div>
        <button
          onClick={() => { setShowModal(true); setError(null); setEmail('') }}
          className="text-xs uppercase tracking-widest font-mono text-neutral-500 hover:text-white border border-neutral-800 hover:border-neutral-600 rounded-full px-4 py-1.5 transition"
        >
          + Añadir
        </button>
      </div>

      {athletes.length === 0 ? (
        <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">Sin atletas</h2>
      ) : (
        <div className="flex flex-col gap-3">
          {athletes.map(athlete => (
            <button
              key={athlete.id}
              onClick={() => onSelect(athlete)}
              className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-900 hover:border-neutral-700 hover:bg-neutral-950 transition-all text-left"
            >
              {athlete.avatar_url ? (
                <Image
                  src={athlete.avatar_url}
                  alt={athlete.full_name ?? ''}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                  <span className="text-white text-xs font-black">{getInitials(athlete.full_name)}</span>
                </div>
              )}
              <span className="flex-1 text-white font-medium text-sm">
                {athlete.full_name ?? 'Sin nombre'}
              </span>
              <span className="text-neutral-600 text-sm font-mono">→</span>
            </button>
          ))}
        </div>
      )}

      {/* Modal añadir atleta */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-6">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm">
            <p className="text-white font-black text-lg uppercase tracking-tight mb-1">Añadir atleta</p>
            <p className="text-neutral-600 text-xs font-mono mb-5">Ingresa el email del atleta registrado</p>

            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="email@ejemplo.com"
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 mb-3"
            />

            {error && (
              <p className="text-red-400 text-xs font-mono mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowModal(false); setEmail(''); setError(null) }}
                disabled={adding}
                className="flex-1 border border-neutral-800 text-neutral-500 hover:text-white font-mono text-xs uppercase tracking-widest rounded-full py-2.5 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={adding || !email.trim()}
                className="flex-1 bg-white text-black font-black text-xs uppercase tracking-widest rounded-full py-2.5 hover:bg-neutral-200 transition disabled:opacity-50"
              >
                {adding ? 'Agregando...' : 'Agregar atleta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Athlete Week View ──────────────────────────────────

function AthleteWeekView({ athlete, onBack, programSlug, programId, onAthleteRemoved }: {
  athlete: Profile
  onBack: () => void
  programSlug: string
  programId: string
  onAthleteRemoved: () => void
}) {
  const today = useMemo(() => getTodayStr(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(0)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [results,       setResults]       = useState<Result[]>([])
  const [loading,       setLoading]       = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing,      setRemoving]      = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  useEffect(() => {
    setLoading(true)
    getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
      .then(async weekWods => {
        setWods(weekWods)
        if (weekWods.length > 0) {
          const res = await getResultsForWodsAndUser(weekWods.map(w => w.id), athlete.id)
          setResults(res)
        } else {
          setResults([])
        }
      })
      .finally(() => setLoading(false))
  }, [weekDates, athlete.id, programSlug])

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeAthleteFromProgram(athlete.id, programId)
      onAthleteRemoved()
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  // Reset block when day changes
  useEffect(() => { setSelectedBlock(0) }, [selectedDate])

  // Reset to current week and today when athlete changes
  useEffect(() => {
    setWeekOffset(0)
    setSelectedDate(today)
    setSelectedBlock(0)
  }, [athlete.id, today])

  const dayWods      = wods.filter(w => w.date === selectedDate)
  const activeWod    = dayWods.find(w => w.block === selectedBlock + 1) ?? null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  // Summary: how many WODs completed this week
  const completedCount = results.length
  const totalWods      = wods.filter(w => w.type !== 'Warmup').length

  return (
    <>
      {/* Athlete header */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-neutral-900">
        <button
          onClick={onBack}
          className="text-neutral-600 hover:text-white text-sm font-mono transition"
        >
          ←
        </button>
        {athlete.avatar_url ? (
          <Image
            src={athlete.avatar_url}
            alt={athlete.full_name ?? ''}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
            <span className="text-white text-xs font-black">{getInitials(athlete.full_name)}</span>
          </div>
        )}
        <div className="flex-1">
          <p className="text-white font-black text-sm tracking-tight">{athlete.full_name ?? 'Sin nombre'}</p>
          {!loading && (
            <p className="text-neutral-600 text-xs font-mono">
              {completedCount}/{totalWods} WODs completados esta semana
            </p>
          )}
        </div>
        <button
          onClick={() => setConfirmRemove(true)}
          className="text-neutral-400 hover:text-red-400 text-xs font-mono transition uppercase tracking-widest border border-neutral-700 hover:border-red-400 rounded-full px-3 py-1"
        >
          Quitar
        </button>

        {/* Modal confirmación */}
        {confirmRemove && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-6">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm">
              <p className="text-white font-black text-lg uppercase tracking-tight mb-1">Quitar atleta</p>
              <p className="text-neutral-500 text-sm font-mono mb-2">
                <span className="text-white">{athlete.full_name ?? 'Este atleta'}</span> perderá el acceso al programa de forma inmediata.
              </p>
              <p className="text-neutral-600 text-xs font-mono mb-6">
                Sus resultados y marcas personales se conservan — solo se elimina la inscripción.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="w-full bg-red-500 hover:bg-red-400 text-white font-black text-xs uppercase tracking-widest rounded-full py-2.5 transition disabled:opacity-50"
                >
                  {removing ? '...' : 'Sí, quitar del programa'}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  className="w-full text-neutral-600 hover:text-neutral-400 font-mono text-xs uppercase tracking-widest py-2 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-900">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="text-neutral-600 hover:text-white transition font-mono text-sm"
        >
          ← anterior
        </button>
        <span className="text-neutral-400 text-xs font-mono uppercase tracking-widest">
          {formatWeekRange(weekDates)}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="text-neutral-600 hover:text-white transition font-mono text-sm"
        >
          siguiente →
        </button>
      </div>

      {/* Day tabs */}
      <div className="border-b border-neutral-900 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-full">
          {weekDates.map((date) => {
            const d          = new Date(date + 'T00:00:00')
            const isToday    = date === today
            const isSelected = date === selectedDate
            const hasWod     = wods.some(w => w.date === date)
            const hasResult  = wods
              .filter(w => w.date === date)
              .some(w => results.some(r => r.wod_id === w.id))

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-1 min-w-[3rem] flex flex-col items-center gap-1 px-1 sm:px-3 py-4 border-b-2 transition-colors ${
                  isSelected ? 'border-white' : 'border-transparent'
                }`}
              >
                <span className={`text-xs uppercase tracking-widest font-mono ${
                  isSelected ? 'text-neutral-400' : 'text-neutral-700'
                }`}>
                  {DAY_SHORT[d.getDay()]}
                </span>
                <span className={`text-lg font-black leading-none ${
                  isSelected ? 'text-white' : isToday ? 'text-neutral-400' : 'text-neutral-600'
                }`}>
                  {d.getDate()}
                </span>
                <div className={`w-1 h-1 rounded-full ${
                  hasResult ? 'bg-white' : hasWod ? 'bg-neutral-700' : 'bg-transparent'
                }`} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 lg:flex-row">
          {/* Panel izquierdo: bloques */}
          {!isSunday(selectedDate) && dayWods.length > 0 && (
            <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden [&::-webkit-scrollbar]:hidden">
              {dayWods.map(wod => {
                const isActive = wod.block === selectedBlock + 1
                const done = results.some(r => r.wod_id === wod.id)
                return (
                  <button
                    key={wod.id}
                    onClick={() => setSelectedBlock(wod.block - 1)}
                    className={`flex-shrink-0 text-left px-6 py-4 border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                      isActive ? 'bg-neutral-900' : 'hover:bg-neutral-950'
                    }`}
                  >
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-black text-sm">{wod.title}</p>
                      {done && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Panel derecho: detalle */}
          <div className="flex-1 flex flex-col min-w-0">
            {isSunday(selectedDate) ? (
              <div className="flex-1 flex flex-col justify-center px-6">
                <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
                <h2 className="text-neutral-800 font-black text-6xl uppercase tracking-tighter leading-none">Descanso</h2>
              </div>
            ) : dayWods.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin entrenos este día</p>
              </div>
            ) : activeWod ? (
              <div className="flex-1 p-6 flex flex-col gap-6">
                <div>
                  <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                    {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                  </p>
                  <h2 className="text-white font-black text-2xl tracking-tight">{activeWod.title}</h2>
                </div>

                {activeWod.description && (
                  <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                    {activeWod.description}
                  </pre>
                )}

                {activeWod.type !== 'Warmup' && (
                  activeResult ? (
                    <div className="border border-neutral-800 rounded-xl p-5">
                      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
                        Resultado · {activeResult.rx ? 'RX' : 'Scaled'}
                      </p>
                      <p className="text-white font-black text-2xl tracking-tight">
                        {getScoreDisplay(activeWod, activeResult)}
                      </p>
                      {activeResult.score_notes && (
                        <p className="text-neutral-600 text-xs font-mono mt-2">{activeResult.score_notes}</p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-neutral-900 rounded-xl p-5">
                      <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Sin resultado</p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center px-6">
                <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">Sin programar</h2>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Page ───────────────────────────────────────────────

function AtletasContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const programSlug = searchParams.get('program') ?? 'bizarro'

  const athleteIdParam = searchParams.get('athlete')

  const [athletes,         setAthletes]         = useState<Profile[]>([])
  const [selectedAthlete,  setSelectedAthlete]  = useState<Profile | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [pendingCount,     setPendingCount]     = useState(0)
  const [programId,        setProgramId]        = useState('')
  const [programName,      setProgramName]      = useState('')
  const [profileName,      setProfileName]      = useState('')
  const [avatarUrl,        setAvatarUrl]        = useState<string | null>(null)
  const { show: showHelp, dismiss: dismissHelp, open: openHelp } = useFirstVisit(user ? `mis-atletas-${user.id}` : '')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(async profile => {
      if (profile?.role !== 'coach') { router.push('/dashboard'); return }

      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)

      const [loadedAthletes, programs] = await Promise.all([
        getAthletes(programSlug),
        getMyPrograms(user.id),
      ])
      setAthletes(loadedAthletes)
      if (athleteIdParam) {
        const found = loadedAthletes.find(a => a.id === athleteIdParam)
        if (found) setSelectedAthlete(found)
      }
      const current = programs.find(p => p.slug === programSlug)
      if (current) { setProgramId(current.id); setProgramName(current.name) }
      const reqs = await getPendingJoinRequests(programs.map(p => p.id))
      setPendingCount(reqs.length)
      setLoading(false)
    })
  }, [authLoading, user, router, programSlug, athleteIdParam])

  if (authLoading || loading) {
    return (
      <CoachPageLoading />
    )
  }

  return (
    <main className="min-h-screen bg-black flex flex-col">

      {/* Header */}
      <CoachHeader
        activeTab="atletas"
        pendingCount={pendingCount}
        programSlug={programSlug}
        programName={programName}
        profileName={profileName}
        avatarUrl={avatarUrl}
      />

      {showHelp && user && <HelpModal helpKey="mis-atletas" onClose={dismissHelp} />}

      {selectedAthlete ? (
        <AthleteWeekView
          athlete={selectedAthlete}
          onBack={() => {
            setSelectedAthlete(null)
            router.push(`/admin/atletas?program=${programSlug}`)
          }}
          programSlug={programSlug}
          programId={programId}
          onAthleteRemoved={() => {
            setAthletes(prev => prev.filter(a => a.id !== selectedAthlete.id))
            setSelectedAthlete(null)
            router.push(`/admin/atletas?program=${programSlug}`)
          }}
        />
      ) : (
        <AthleteList
          athletes={athletes}
          onSelect={(athlete) => {
            setSelectedAthlete(athlete)
            router.push(`/admin/atletas?program=${programSlug}&athlete=${athlete.id}`)
          }}
          programId={programId}
          programSlug={programSlug}
          onAthleteAdded={athlete => setAthletes(prev => [...prev, athlete].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')))}
          onOpenHelp={openHelp}
        />
      )}
    </main>
  )
}

export default function AtletasPage() {
  return (
    <Suspense>
      <AtletasContent />
    </Suspense>
  )
}
