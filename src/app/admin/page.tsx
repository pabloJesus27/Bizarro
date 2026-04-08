'use client'

import { useEffect, useMemo, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getProfile, getWodsForWeek, createWod, deleteWod, deleteWodsForDay, deleteWodsForWeek, getMyPrograms, getPendingJoinRequests, updateWodTimerConfig, reorderBlocks } from '@/lib/db'
import LoadWeekModal from '@/components/LoadWeekModal'
import CoachHeader from '@/components/CoachHeader'
import { CoachPageLoading } from '@/components/PageLoading'
import RankingSection from '@/components/RankingSection'
import WodModal from '@/components/admin/WodModal'
import type { Wod } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL } from '@/lib/wod-utils'
import WelcomeModal from '@/components/WelcomeModal'

// ── Admin Page ─────────────────────────────────────────

function AdminContent() {
  const { user, session, loading: authLoading } = useAuth()
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
  const [loadWodOpen,        setLoadWodOpen]        = useState(false)
  const [loadWeekOpen,       setLoadWeekOpen]       = useState(false)
  const [generatingTimers,   setGeneratingTimers]   = useState(false)
  const [timerGenProgress,   setTimerGenProgress]   = useState<{ current: number; total: number } | null>(null)
  const [profileName,   setProfileName]   = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [programName,   setProgramName]   = useState('')
  const [pendingCount,  setPendingCount]  = useState(0)
  const [showWelcome,   setShowWelcome]   = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Auth + role check
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      if (profile?.role !== 'coach') router.push('/dashboard')
      setProfileName(profile?.full_name ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)
      const key = `bizarro_welcome_coach_${user.id}`
      if (!localStorage.getItem(key)) setShowWelcome(true)
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

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string }[]) {
    if (parsed.length > 0) {
      const dates = parsed.map(w => w.date).sort()
      await deleteWodsForWeek(dates[0], dates[dates.length - 1], programSlug as import('@/lib/types').Program)
    }
    for (const { date, block, title, type, description } of parsed) {
      await createWod({ date, block, title, type, description, program: programSlug as import('@/lib/types').Program })
    }
    const updated = await getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
    setWods(updated)
  }

  async function handleGenerateWeekTimers() {
    const TIMER_TYPES = new Set(['For Time', 'AMRAP', 'EMOM', 'For Max'])
    const eligible = wods.filter(w =>
      w.date >= weekDates[0] && w.date <= weekDates[6] &&
      !w.timer_config &&
      TIMER_TYPES.has(w.type)
    )
    if (eligible.length === 0) return
    setGeneratingTimers(true)
    setTimerGenProgress({ current: 0, total: eligible.length })
    for (let i = 0; i < eligible.length; i++) {
      const wod = eligible[i]
      setTimerGenProgress({ current: i + 1, total: eligible.length })
      try {
        const res = await fetch('/api/generate-timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ title: wod.title, description: wod.description, type: wod.type }),
        })
        const cfg = await res.json()
        if (!cfg.error) {
          await updateWodTimerConfig(wod.id, cfg)
          setWods(prev => prev.map(w => w.id === wod.id ? { ...w, timer_config: cfg } : w))
        }
      } catch { /* continúa con el siguiente */ }
    }
    setGeneratingTimers(false)
    setTimerGenProgress(null)
  }

  const dragIdx        = useRef<number | null>(null)
  const touchDrag      = useRef<{ from: number; over: number } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [touchVisual, setTouchVisual] = useState<{ from: number; over: number } | null>(null)

  async function handleReorderBlocks(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const sorted = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
    const next = [...sorted]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    const updates = next.map((w, i) => ({ id: w.id, block: i + 1 }))
    setWods(prev => {
      const others = prev.filter(w => w.date !== selectedDate)
      return [...others, ...next.map((w, i) => ({ ...w, block: i + 1 }))]
    })
    setSelectedBlock(toIdx + 1)
    await reorderBlocks(updates)
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

        {/* Generar timers — barra ancho completo */}
        {wods.some(w => w.date >= weekDates[0] && w.date <= weekDates[6] && !w.timer_config && ['For Time','AMRAP','EMOM','For Max'].includes(w.type)) && (
          <button
            onClick={handleGenerateWeekTimers}
            disabled={generatingTimers}
            className="w-full border-b border-neutral-900 px-6 py-3 text-center text-xs font-mono uppercase tracking-widest text-neutral-500 hover:text-white hover:bg-neutral-950 transition disabled:opacity-50"
          >
            {generatingTimers && timerGenProgress
              ? `⚡ Generando ${timerGenProgress.current}/${timerGenProgress.total}...`
              : '⚡ Generar timers'}
          </button>
        )}

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
              {dayWods.map((wod, idx) => {
                const isActive  = wod.block === selectedBlock
                const isDragOver = touchVisual?.over === idx
                return (
                  <div
                    key={wod.id}
                    draggable
                    onDragStart={() => { dragIdx.current = idx }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx.current !== null) handleReorderBlocks(dragIdx.current, idx)
                      dragIdx.current = null
                    }}
                    onTouchStart={() => {
                      longPressTimer.current = setTimeout(() => {
                        touchDrag.current = { from: idx, over: idx }
                        setTouchVisual({ from: idx, over: idx })
                        navigator.vibrate?.(50)
                      }, 600)
                    }}
                    onTouchMove={e => {
                      if (!touchDrag.current) return
                      e.preventDefault()
                      const touch = e.touches[0]
                      const el = document.elementFromPoint(touch.clientX, touch.clientY)
                      const target = el?.closest('[data-block-idx]') as HTMLElement | null
                      if (target) {
                        const over = parseInt(target.dataset.blockIdx ?? '')
                        if (!isNaN(over) && touchDrag.current.over !== over) {
                          touchDrag.current.over = over
                          setTouchVisual({ from: touchDrag.current.from, over })
                        }
                      }
                    }}
                    onTouchEnd={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current)
                        longPressTimer.current = null
                      }
                      if (touchDrag.current) {
                        handleReorderBlocks(touchDrag.current.from, touchDrag.current.over)
                        touchDrag.current = null
                        setTouchVisual(null)
                      }
                    }}
                    data-block-idx={idx}
                    className={`flex-shrink-0 flex items-stretch border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                      isActive ? 'bg-neutral-900' : isDragOver ? 'bg-neutral-800' : 'hover:bg-neutral-950'
                    }`}
                  >
                    <span className="flex items-center px-2 cursor-grab active:cursor-grabbing touch-none text-neutral-700 hover:text-neutral-400 transition">
                      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                        <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
                        <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                        <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
                      </svg>
                    </span>
                    <button
                      onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null); }}
                      className="flex-1 text-left px-4 py-4"
                    >
                      <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                        {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                      </p>
                      <p className="text-white font-black text-sm">{wod.title}</p>
                    </button>
                  </div>
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
              const saved = await createWod({ date: selectedDate, block: firstBlock + i, title: item.title, type: item.type, description: item.description, program: programSlug })
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

      {showWelcome && (
        <WelcomeModal
          mode="coach"
          onClose={() => {
            localStorage.setItem(`bizarro_welcome_coach_${user!.id}`, '1')
            setShowWelcome(false)
          }}
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
