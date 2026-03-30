'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getWodsForWeek, createWod, deleteWod, deleteWodsForDay, deleteWodsForWeek, getMyPrograms, getPendingJoinRequests } from '@/lib/db'
import LoadWeekModal from '@/components/LoadWeekModal'
import CoachHeader from '@/components/CoachHeader'
import { CoachPageLoading } from '@/components/PageLoading'
import RankingSection from '@/components/RankingSection'
import WodModal from '@/components/admin/WodModal'
import type { Wod } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL } from '@/lib/wod-utils'

// ── Admin Page ─────────────────────────────────────────

function AdminContent() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const programSlug  = searchParams.get('program') ?? 'bizarro'

  const today = useMemo(() => getTodayStr(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(1)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingWod,    setEditingWod]    = useState<Wod | undefined>()
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [deletingDay,   setDeletingDay]   = useState(false)
  const [deletingWeek,  setDeletingWeek]  = useState(false)
  const [pendingBlock,  setPendingBlock]  = useState<number | null>(null)
  const [loadWeekOpen,  setLoadWeekOpen]  = useState(false)
  const [profileName,   setProfileName]   = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [programName,   setProgramName]   = useState('')
  const [pendingCount,  setPendingCount]  = useState(0)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Auth + role check
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      if (profile?.role !== 'coach') router.push('/dashboard')
      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)
    })

    getMyPrograms(user.id).then(async programs => {
      const found = programs.find(p => p.slug === programSlug)
      setProgramName(found?.name ?? programSlug)
      const reqs = await getPendingJoinRequests(programs.map(p => p.id))
      setPendingCount(reqs.length)
    })
  }, [authLoading, user, router])

  // Load week WODs
  useEffect(() => {
    setLoading(true)
    getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
      .then(setWods)
      .finally(() => setLoading(false))
  }, [weekDates])

  // Reset to first day when week changes
  useEffect(() => {
    setSelectedDate(weekDates[0])
    setSelectedBlock(1)
  }, [weekOffset, weekDates])

  function handleSaved(wod: Wod) {
    setWods(prev => {
      const idx = prev.findIndex(w => w.id === wod.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = wod; return u }
      return [...prev, wod]
    })
    setPendingBlock(null)
    setSelectedBlock(wod.block)
    setModalOpen(false)
    setEditingWod(undefined)
  }

  async function handleDelete(id: string) {
    await deleteWod(id)
    setWods(prev => prev.filter(w => w.id !== id))
    setDeletingId(null)
  }

  async function handleDeleteDay() {
    await deleteWodsForDay(selectedDate, programSlug)
    setWods(prev => prev.filter(w => w.date !== selectedDate))
    setDeletingDay(false)
  }

  async function handleDeleteWeek() {
    await deleteWodsForWeek(weekDates[0], weekDates[6], programSlug)
    setWods([])
    setDeletingWeek(false)
  }

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string; timerConfig?: import('@/lib/types').TimerConfig | null }[]) {
    for (const { date, block, title, type, description, timerConfig } of parsed) {
      const tc = Array.isArray(timerConfig) ? { type: 'mix' as const, blocks: timerConfig } : timerConfig
      const extra = tc != null ? { timer_config: tc } : {}
      await createWod({ date, block, title, type, description, program: programSlug as import('@/lib/types').Program, ...extra })
    }
    const updated = await getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
    setWods(updated)
  }

  const dayWods   = wods.filter(w => w.date === selectedDate)
  const activeWod = dayWods.find(w => w.block === selectedBlock)

  if (authLoading || loading) {
    return (
      <CoachPageLoading />
    )
  }

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        {/* Header */}
        <CoachHeader
          activeTab="home"
          pendingCount={pendingCount}
          programSlug={programSlug}
          programName={programName}
          profileName={profileName}
          avatarUrl={avatarUrl}
        />

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-900">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="text-neutral-600 hover:text-white transition font-mono text-sm"
          >
            ← anterior
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-neutral-400 text-sm font-mono uppercase tracking-widest">
              {formatWeekRange(weekDates)}
            </span>
            <button
              onClick={() => setLoadWeekOpen(true)}
              className="text-neutral-600 hover:text-white text-xs font-mono transition"
            >
              ↓ Cargar semana
            </button>
            {wods.length > 0 && (deletingWeek ? (
              <div className="flex gap-2 mt-1">
                <button onClick={handleDeleteWeek} className="text-red-400 text-xs font-mono">Confirmar</button>
                <button onClick={() => setDeletingWeek(false)} className="text-neutral-600 text-xs font-mono">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setDeletingWeek(true)} className="text-neutral-700 hover:text-red-400 text-xs font-mono transition">
                × Borrar semana
              </button>
            ))}
          </div>
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

              return (
                <button
                  key={date}
                  onClick={() => { setSelectedDate(date); setSelectedBlock(1); setPendingBlock(null) }}
                  className={`flex-1 min-w-[3rem] flex flex-col items-center gap-1 px-1 sm:px-5 py-4 border-b-2 transition-colors ${
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
                    hasWod ? (isSelected ? 'bg-white' : 'bg-neutral-600') : 'bg-transparent'
                  }`} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 py-8 max-w-2xl mx-auto w-full">

          {isSunday(selectedDate) ? (
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
              <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">
                Descanso
              </h2>
            </div>
          ) : (<>

          {/* Block tabs — solo bloques con contenido + tab pendiente + botón añadir */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {dayWods.map((wod) => (
              <button
                key={wod.block}
                onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null) }}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  selectedBlock === wod.block && pendingBlock === null
                    ? 'bg-white text-black'
                    : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                }`}
              >
                {WOD_TYPE_LABEL[wod.type] ?? wod.type}
              </button>
            ))}
            {pendingBlock !== null && (
              <div className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono bg-white text-black">
                Bloque {pendingBlock}
              </div>
            )}
            {dayWods.length === 0 && pendingBlock === null && (
              <div className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono bg-white text-black">
                Bloque 1
              </div>
            )}
            <button
              onClick={() => {
                const nextBlock = dayWods.length > 0 ? Math.max(...dayWods.map(w => w.block)) + 1 : 1
                setPendingBlock(nextBlock)
                setSelectedBlock(nextBlock)
              }}
              className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition border border-dashed border-neutral-700 text-neutral-600 hover:border-neutral-500 hover:text-neutral-400"
            >
              + Bloque
            </button>
          </div>

          {/* Block content */}
          {activeWod ? (
            <div className="flex flex-col gap-6">
              {/* Type badge */}
              <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1 w-fit">
                <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                  {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-white font-black text-5xl sm:text-6xl leading-none tracking-tighter uppercase">
                {activeWod.title}
              </h1>

              {/* Description */}
              <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                {activeWod.description}
              </pre>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setEditingWod(activeWod); setModalOpen(true) }}
                  className="flex-1 border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm"
                >
                  Editar
                </button>

                {deletingId === activeWod.id ? (
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => handleDelete(activeWod.id)}
                      className="flex-1 bg-red-600 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:bg-red-500 transition text-sm"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="flex-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-neutral-500 transition text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(activeWod.id)}
                    className="flex-1 border border-neutral-800 text-neutral-600 font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-red-800 hover:text-red-500 transition text-sm"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {activeWod.type !== 'Warmup' && <RankingSection wod={activeWod} />}

              {/* Borrar día */}
              <div className="pt-2 border-t border-neutral-900">
                {deletingDay ? (
                  <div className="flex gap-3">
                    <button onClick={handleDeleteDay} className="text-red-400 text-xs font-mono uppercase tracking-widest">Confirmar borrar día</button>
                    <button onClick={() => setDeletingDay(false)} className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingDay(true)} className="text-neutral-700 hover:text-red-400 text-xs font-mono uppercase tracking-widest transition">
                    × Borrar todos los WODs de este día
                  </button>
                )}
              </div>
            </div>
          ) : (dayWods.length === 0 || pendingBlock !== null) ? (
            <WodModal
              inline
              date={selectedDate}
              block={pendingBlock ?? 1}
              program={programSlug}
              onClose={() => {}}
              onSaved={handleSaved}
            />
          ) : null}
          </>)}
        </div>
      </main>

      {modalOpen && (
        <WodModal
          date={selectedDate}
          block={selectedBlock}
          wod={editingWod}
          program={programSlug}
          onClose={() => { setModalOpen(false); setEditingWod(undefined) }}
          onSaved={handleSaved}
        />
      )}

      {loadWeekOpen && (
        <LoadWeekModal
          weekDates={weekDates}
          programSlug={programSlug}
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}
    </>
  )
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  )
}
