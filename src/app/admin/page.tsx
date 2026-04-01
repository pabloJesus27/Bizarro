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
  const [pendingMode,   setPendingMode]   = useState<'select' | 'manual' | null>(null)
  const [loadWodOpen,   setLoadWodOpen]   = useState(false)
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
    setPendingMode(null)
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
    if (parsed.length > 0) {
      const dates = parsed.map(w => w.date).sort()
      await deleteWodsForWeek(dates[0], dates[dates.length - 1], programSlug as import('@/lib/types').Program)
    }
    for (const { date, block, title, type, description, timerConfig } of parsed) {
      const tc = Array.isArray(timerConfig) ? { type: 'mix' as const, blocks: timerConfig } : timerConfig
      const extra = tc != null ? { timer_config: tc } : {}
      await createWod({ date, block, title, type, description, program: programSlug as import('@/lib/types').Program, ...extra })
    }
    const updated = await getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
    setWods(updated)
  }

  const dayWods   = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
  const activeWod = selectedBlock > 0 ? dayWods.find(w => w.block === selectedBlock) : undefined

  if (authLoading || loading) return <CoachPageLoading />

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
            {wods.length > 0 ? (deletingWeek ? (
              <div className="flex gap-2">
                <button onClick={handleDeleteWeek} className="text-red-400 text-xs font-mono">Confirmar</button>
                <button onClick={() => setDeletingWeek(false)} className="text-neutral-600 text-xs font-mono">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setDeletingWeek(true)} className="text-neutral-700 hover:text-red-400 text-xs font-mono transition">
                × Borrar semana
              </button>
            )) : (
              <button
                onClick={() => setLoadWeekOpen(true)}
                className="text-neutral-600 hover:text-white text-xs font-mono transition"
              >
                ↓ Cargar semana
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="text-neutral-600 hover:text-white transition font-mono text-sm"
          >
            siguiente →
          </button>
        </div>

        {/* Day selector */}
        <div className="border-b border-neutral-900 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-full gap-1 px-6 pt-2 pb-4">
            {weekDates.map(d => {
              if (isSunday(d)) return null
              const hasWods    = wods.some(w => w.date === d)
              const isSelected = d === selectedDate
              const isToday    = d === today
              return (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setSelectedBlock(1); setPendingBlock(null) }}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition min-w-[44px] flex-1 ${
                    isSelected ? 'bg-white' : 'hover:bg-neutral-900'
                  }`}
                >
                  <span className={`text-xs font-mono uppercase tracking-widest ${isSelected ? 'text-black' : 'text-neutral-500'}`}>
                    {DAY_SHORT[new Date(d + 'T12:00:00').getDay()]}
                  </span>
                  <span className={`text-sm font-black ${isSelected ? 'text-black' : isToday ? 'text-white' : 'text-neutral-500'}`}>
                    {new Date(d + 'T12:00:00').getDate()}
                  </span>
                  {hasWods && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-black' : 'bg-neutral-600'}`} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex flex-col flex-1 lg:flex-row">

          {/* Panel izquierdo: lista de bloques + botón añadir */}
          <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden">
            {isSunday(selectedDate) ? (
              <div className="px-6 py-4">
                <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Descanso</p>
              </div>
            ) : (<>
              {dayWods.map(wod => {
                const isActive = wod.block === selectedBlock
                return (
                  <button
                    key={wod.id}
                    onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null); }}
                    className={`flex-shrink-0 text-left px-6 py-4 border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                      isActive ? 'bg-neutral-900' : 'hover:bg-neutral-950'
                    }`}
                  >
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                    </p>
                    <p className="text-white font-black text-sm">{wod.title}</p>
                  </button>
                )
              })}
              {/* Botón nuevo bloque */}
              <button
                onClick={() => {
                  const next = dayWods.length > 0 ? Math.max(...dayWods.map(w => w.block)) + 1 : 1
                  setPendingBlock(next)
                  setSelectedBlock(0)
                  setPendingMode('select')
                }}
                className={`flex-shrink-0 text-left px-6 py-4 border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                  selectedBlock === 0 ? 'bg-neutral-900' : 'hover:bg-neutral-950'
                }`}
              >
                <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">Nuevo</p>
                <p className="text-neutral-400 font-black text-sm">+ Añadir bloque</p>
              </button>
            </>)}
          </div>

          {/* Panel derecho */}
          <div className="flex-1 flex flex-col min-w-0">

            {isSunday(selectedDate) ? (
              <div className="flex-1 flex flex-col justify-center px-8 py-8">
                <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">Descanso</h2>
              </div>
            ) : (<>

              {/* Selector manual / imagen */}
              {selectedBlock === 0 && pendingMode === 'select' && (
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <p className="text-neutral-500 text-sm font-mono">¿Cómo quieres añadir el bloque?</p>
                  {([
                    { key: 'manual', label: 'Escribir manualmente', desc: 'Rellena el formulario' },
                    { key: 'image',  label: 'Cargar desde imagen',  desc: 'La IA lee el WOD de una foto' },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { if (key === 'manual') setPendingMode('manual'); else setLoadWodOpen(true) }}
                      className="w-full border border-neutral-800 hover:border-neutral-500 rounded-xl px-5 py-4 flex items-center justify-between text-left transition"
                    >
                      <div>
                        <p className="text-white font-bold uppercase tracking-widest text-sm">{label}</p>
                        <p className="text-neutral-600 text-xs font-mono mt-0.5">{desc}</p>
                      </div>
                      <span className="text-neutral-600 text-lg">→</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Formulario nuevo bloque (manual) */}
              {selectedBlock === 0 && pendingMode === 'manual' && pendingBlock !== null && (
                <div className="p-6">
                  <WodModal
                    inline
                    date={selectedDate}
                    block={pendingBlock}
                    program={programSlug}
                    onClose={() => setPendingMode('select')}
                    onSaved={wod => { handleSaved(wod); setPendingMode(null) }}
                  />
                </div>
              )}

              {/* Detalle WOD */}
              {activeWod && selectedBlock > 0 && (
                <div className="flex-1 flex flex-col">
                  {/* Tabs */}
                  <div className="flex border-b border-neutral-900 px-6">
                    <button className="py-3 mr-6 text-xs font-mono uppercase tracking-widest border-b-2 border-white text-white">
                      WOD
                    </button>
                  </div>

                  <div className="flex-1 p-6 flex flex-col gap-5 max-w-2xl">
                    {/* Tipo */}
                    <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1 w-fit">
                      <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                        {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                      </span>
                    </div>

                    {/* Título */}
                    <h1 className="text-white font-black text-4xl sm:text-5xl leading-none tracking-tighter uppercase">
                      {activeWod.title}
                    </h1>

                    {/* Descripción */}
                    <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                      {activeWod.description}
                    </pre>

                    {/* Acciones */}
                    <div className="flex gap-3">
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
                            className="flex-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-widest rounded-xl px-4 py-3 transition text-sm"
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
                </div>
              )}

              {/* Estado vacío */}
              {dayWods.length === 0 && selectedBlock !== 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin WODs este día</p>
                </div>
              )}
            </>)}
          </div>
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
          forceMode="week"
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}

      {loadWodOpen && selectedBlock === 0 && pendingBlock !== null && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          programSlug={programSlug}
          forceMode="day"
          onConfirm={async (parsed) => {
            const sorted = [...parsed].sort((a, b) => a.block - b.block)
            const firstBlock = pendingBlock
            for (let i = 0; i < sorted.length; i++) {
              const item = sorted[i]
              const tc = Array.isArray(item.timerConfig) ? { type: 'mix' as const, blocks: item.timerConfig } : item.timerConfig
              const extra = tc != null ? { timer_config: tc } : {}
              const saved = await createWod({ date: selectedDate, block: firstBlock + i, title: item.title, type: item.type, description: item.description, program: programSlug, ...extra })
              handleSaved(saved)
            }
            setLoadWodOpen(false)
            setPendingBlock(null)
            setPendingMode(null)
            setSelectedBlock(firstBlock)
          }}
          onClose={() => { setLoadWodOpen(false); setPendingMode('select') }}
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
