'use client'


import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import ResultModal from '@/components/ResultModal'
import LoadWeekModal from '@/components/LoadWeekModal'
import {
  getProfile, getWodsForWeekLibre, createLibreWod, deleteWod,
  deleteWodsForDay, deleteWodsForWeek,
  getResultsForWods, getMyPRs, getMyOwnedCommunity, updateWodTimerConfig, reorderBlocks,
} from '@/lib/db'
import type { PersonalRecord } from '@/lib/db'
import type { Wod, Result } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL, getScoreDisplay } from '@/lib/wod-utils'
import WodForm from '@/components/libre/WodForm'
import PRCalculator from '@/components/PRCalculator'

// ── Libre Page ───────────────────────────────────────────

export default function LibrePage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const today = useMemo(() => getTodayStr(), [])

  const [weekOffset,     setWeekOffset]     = useState(0)
  const [selectedDate,   setSelectedDate]   = useState(today)
  const [selectedBlock,  setSelectedBlock]  = useState(1)
  const [pendingBlock,   setPendingBlock]   = useState<number | null>(null)
  const [wods,           setWods]           = useState<Wod[]>([])
  const [results,        setResults]        = useState<Result[]>([])
  const [loading,        setLoading]        = useState(true)
  const [editingWod,     setEditingWod]     = useState<Wod | undefined>()
  const [deletingId,     setDeletingId]     = useState<string | null>(null)
  const [deletingDay,    setDeletingDay]    = useState(false)
  const [deletingWeek,   setDeletingWeek]   = useState(false)
  const [modalWod,       setModalWod]       = useState<Wod | null>(null)
  const [newPR,          setNewPR]          = useState<string | null>(null)
  const [generatingTimer, setGeneratingTimer] = useState(false)
  const [timerError,     setTimerError]     = useState(false)
  const [wodError,       setWodError]       = useState<string | null>(null)
  const [loadWeekOpen,       setLoadWeekOpen]       = useState(false)
  const [loadWodOpen,        setLoadWodOpen]        = useState(false)
  const [pendingMode,        setPendingMode]        = useState<'select' | 'manual' | null>(null)
  const [prs,                setPrs]                = useState<PersonalRecord[]>([])
  const [communitySlug,      setCommunitySlug]      = useState<string | undefined>(undefined)
  const [generatingTimers,   setGeneratingTimers]   = useState(false)
  const [timerGenProgress,   setTimerGenProgress]   = useState<{ current: number; total: number } | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const initPosRef = useRef<{ date: string; block: number } | null>(
    typeof window !== 'undefined'
      ? (() => { try { const s = sessionStorage.getItem('biz_libre_pos'); return s ? JSON.parse(s) : null } catch { return null } })()
      : null
  )
  const prevSelectedDateRef = useRef(today)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    Promise.all([
      getProfile(user.id),
      getMyPRs().catch(() => []),
      getMyOwnedCommunity(user.id).catch(() => null),
    ]).then(([profile, userPRs, community]) => {
      if (profile?.role === 'coach') { router.push('/select-program'); return }
      setPrs(userPRs)
      if (community) setCommunitySlug(community.slug)
      setLoading(false)
    })
  }, [authLoading, user, router])

  useEffect(() => {
    if (loading || !user) return
    setWodError(null)
    getWodsForWeekLibre(user.id, weekDates[0], weekDates[6])
      .then(async weekWods => {
        setWods(weekWods)
        if (weekWods.length > 0) {
          const res = await getResultsForWods(weekWods.map(w => w.id))
          setResults(res)
        } else {
          setResults([])
        }
      })
      .catch(err => {
        if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
          router.push('/login')
        } else {
          setWodError('No se pudieron cargar los WODs. Intenta recargar la página.')
        }
      })
  }, [weekDates, loading, user])

  useEffect(() => {
    setSelectedDate(weekOffset === 0 ? today : weekDates[0])
    setSelectedBlock(1)
    setPendingBlock(null)
    setPendingMode(null)
  }, [weekOffset, weekDates, today])

  useEffect(() => {
    const dateChanged = prevSelectedDateRef.current !== selectedDate
    prevSelectedDateRef.current = selectedDate
    const firstBlock = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)[0]
    const pos = initPosRef.current
    if (pos && pos.date === selectedDate && wods.some(w => w.date === selectedDate && w.block === pos.block)) {
      initPosRef.current = null
      setSelectedBlock(pos.block)
    } else if (dateChanged) {
      setSelectedBlock(firstBlock?.block ?? 1)
    } else {
      // Wods recargados en el mismo día — conservar bloque si sigue existiendo
      setSelectedBlock(prev => {
        const exists = prev > 0 && wods.some(w => w.date === selectedDate && w.block === prev)
        return exists ? prev : (firstBlock?.block ?? 1)
      })
    }
    setPendingBlock(null)
    setPendingMode(null)
    setEditingWod(undefined)
  }, [selectedDate, wods])

  useEffect(() => {
    sessionStorage.setItem('biz_libre_pos', JSON.stringify({ date: selectedDate, block: selectedBlock }))
  }, [selectedDate, selectedBlock])

  function handleWodSaved(wod: Wod) {
    setWods(prev => {
      const idx = prev.findIndex(w => w.id === wod.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = wod; return u }
      return [...prev, wod]
    })
    setSelectedBlock(wod.block)
    setPendingBlock(null)
    setPendingMode(null)
    setEditingWod(undefined)
  }

  function handleResultSaved(result: Result, isNewPR: boolean) {
    setResults(prev => {
      const idx = prev.findIndex(r => r.wod_id === result.wod_id)
      if (idx >= 0) { const u = [...prev]; u[idx] = result; return u }
      return [...prev, result]
    })
    setModalWod(null)
    if (isNewPR && activeWod) {
      setNewPR(activeWod.title)
      setTimeout(() => setNewPR(null), 4000)
    }
  }

  async function handleDelete(id: string) {
    await deleteWod(id)
    setWods(prev => prev.filter(w => w.id !== id))
    setDeletingId(null)
    const firstBlock = wods.filter(w => w.date === selectedDate && w.id !== id).sort((a, b) => a.block - b.block)[0]
    setSelectedBlock(firstBlock?.block ?? 1)
  }

  async function handleDeleteDay() {
    if (!user) return
    await deleteWodsForDay(selectedDate, 'libre', user.id)
    setWods(prev => prev.filter(w => w.date !== selectedDate))
    setDeletingDay(false)
  }

  async function handleDeleteWeek() {
    if (!user) return
    await deleteWodsForWeek(weekDates[0], weekDates[6], 'libre', user.id)
    setWods([])
    setDeletingWeek(false)
  }

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string }[]) {
    if (!user) return
    for (const { date, block, title, type, description } of parsed) {
      try {
        await createLibreWod({ date, block, title, type, description }, user.id)
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === '23505') continue
        throw err
      }
    }
    const updated = await getWodsForWeekLibre(user.id, weekDates[0], weekDates[6])
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

  async function handleGenerateTimer(wod: { title: string; description: string; type: string; timer_config?: import('@/lib/types').TimerConfig | null }) {
    if (wod.timer_config) {
      const cfg = Array.isArray(wod.timer_config)
        ? { type: 'mix' as const, blocks: wod.timer_config }
        : wod.timer_config
      sessionStorage.setItem('generated_timer_config', JSON.stringify(cfg))
      router.push('/timer')
      return
    }
    setGeneratingTimer(true)
    setTimerError(false)
    try {
      const res = await fetch('/api/generate-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(wod),
      })
      const cfg = await res.json()
      if (cfg.error) { setTimerError(true); return }
      sessionStorage.setItem('generated_timer_config', JSON.stringify(cfg))
      router.push('/timer')
    } catch { setTimerError(true) } finally {
      setGeneratingTimer(false)
    }
  }

  const dragIdx   = useRef<number | null>(null)
  const touchDrag = useRef<{ from: number; over: number } | null>(null)
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
    setSelectedBlock(next[toIdx].block !== moved.block ? toIdx + 1 : selectedBlock)
    await reorderBlocks(updates)
  }

  const dayWods   = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
  const activeWod = selectedBlock > 0 ? (dayWods.find(w => w.block === selectedBlock) ?? null) : null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  if (authLoading || loading) return <AthletePageLoading />

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        <AppHeader homeRoute="/libre" communitySlug={communitySlug} showCommunityTab={true} />

        {/* Banner nuevo PR */}
        {newPR && (
          <div className="bg-white text-black px-6 py-3 flex items-center justify-center gap-3">
            <span className="font-black uppercase tracking-widest text-sm">NUEVO PR</span>
            <span className="font-mono text-sm">{newPR}</span>
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-900">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= -26}
            className="text-neutral-600 hover:text-white transition font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← anterior
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-neutral-400 text-xs font-mono uppercase tracking-widest">
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

        {wodError && <div className="px-6 py-4 text-red-400 text-xs font-mono">{wodError}</div>}

        {/* Contenido principal */}
        <div className="flex flex-col flex-1 lg:flex-row">

          {/* Panel izquierdo: lista de bloques + botón añadir */}
          <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden">
            {dayWods.map((wod, i) => {
              const result   = results.find(r => r.wod_id === wod.id)
              const isActive = wod.block === selectedBlock && !editingWod
              return (
                <div
                  key={wod.id}
                  data-idx={i}
                  draggable
                  onDragStart={() => { dragIdx.current = i }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    const from = dragIdx.current
                    dragIdx.current = null
                    if (from === null) return
                    handleReorderBlocks(from, i)
                  }}
                  className={`flex-shrink-0 flex items-stretch border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                    touchVisual?.from === i ? 'opacity-40' : touchVisual?.over === i ? 'ring-1 ring-inset ring-white' : ''
                  } ${isActive ? 'bg-neutral-900' : 'bg-black hover:bg-neutral-950'}`}
                >
                  <span
                    style={{ touchAction: 'none' }}
                    className="flex items-center pl-3 pr-1 text-neutral-700 hover:text-white transition cursor-grab active:cursor-grabbing"
                    onTouchStart={() => { touchDrag.current = { from: i, over: i }; setTouchVisual({ from: i, over: i }) }}
                    onTouchMove={e => {
                      if (!touchDrag.current) return
                      const touch = e.touches[0]
                      const el = document.elementFromPoint(touch.clientX, touch.clientY)
                      const blockEl = el?.closest('[data-idx]')
                      if (blockEl) {
                        const over = Number(blockEl.getAttribute('data-idx'))
                        touchDrag.current.over = over
                        setTouchVisual({ from: touchDrag.current.from, over })
                      }
                    }}
                    onTouchEnd={() => {
                      if (!touchDrag.current) return
                      const { from, over } = touchDrag.current
                      touchDrag.current = null
                      setTouchVisual(null)
                      handleReorderBlocks(from, over)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <button
                    onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null); setPendingMode(null); setEditingWod(undefined) }}
                    className="flex-1 text-left px-4 py-4"
                  >
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                    </p>
                    <p className="text-white font-black text-sm">{wod.title}</p>
                    {result && (
                      <p className="text-neutral-400 text-xs font-mono mt-1">{getScoreDisplay(wod, result)}</p>
                    )}
                  </button>
                </div>
              )
            })}
            {/* Tab nuevo bloque */}
            <button
              onClick={() => {
                const next = dayWods.length > 0 ? Math.max(...dayWods.map(w => w.block)) + 1 : 1
                setPendingBlock(next)
                setSelectedBlock(0)
                setEditingWod(undefined)
                setPendingMode('select')
              }}
              className={`flex-shrink-0 text-left px-6 py-4 border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                selectedBlock === 0 ? 'bg-neutral-900' : 'bg-black hover:bg-neutral-950'
              }`}
            >
              <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">Nuevo</p>
              <p className="text-neutral-400 font-black text-sm">+ Añadir bloque</p>
            </button>
          </div>

          {/* Panel derecho */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Tab Añadir bloque: selector */}
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
                    onClick={() => {
                      if (key === 'manual') setPendingMode('manual')
                      else setLoadWodOpen(true)
                    }}
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

            {/* Tab Añadir bloque: formulario manual */}
            {selectedBlock === 0 && pendingMode === 'manual' && (
              <div className="p-6">
                <WodForm
                  date={selectedDate}
                  block={pendingBlock!}
                  onSaved={handleWodSaved}
                  onCancel={() => setPendingMode('select')}
                />
              </div>
            )}

            {/* Formulario editar WOD */}
            {activeWod && editingWod && (
              <div className="p-6">
                <WodForm
                  date={selectedDate}
                  block={editingWod.block}
                  wod={editingWod}
                  onSaved={wod => { handleWodSaved(wod); setEditingWod(undefined) }}
                  onCancel={() => setEditingWod(undefined)}
                />
              </div>
            )}

            {/* Detalle WOD */}
            {activeWod && !editingWod && pendingBlock === null && (
              <div className="flex-1 flex flex-col">
                {/* Tabs */}
                <div className="flex border-b border-neutral-900 px-6">
                  <button
                    onClick={() => {}}
                    className="py-3 mr-6 text-xs font-mono uppercase tracking-widest border-b-2 border-white text-white"
                  >
                    WOD
                  </button>
                </div>

                <div className="flex-1 p-6">
                  <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                    {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                  </p>
                  <h2 className="text-white font-black text-2xl tracking-tight mb-4">{activeWod.title}</h2>

                  <div className="flex gap-6 items-start">
                    <div className="flex-1 min-w-0 flex flex-col gap-5">
                      {activeWod.description && (
                        <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                          {activeWod.description}
                        </pre>
                      )}

                      {/* Generar timer */}
                      {!['Warmup', 'Strength', 'Gymnastics'].includes(activeWod.type) && (
                        <div>
                          <button
                            onClick={() => handleGenerateTimer(activeWod)}
                            disabled={generatingTimer}
                            className="border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-50"
                          >
                            {generatingTimer ? 'Generando...' : '⚡ Generar timer'}
                          </button>
                          {timerError && (
                            <p className="text-red-500 text-xs font-mono mt-2">Error al generar el timer.</p>
                          )}
                        </div>
                      )}

                      {/* Resultado */}
                      {activeWod.type !== 'Warmup' && (
                        activeResult ? (
                          <div className="border border-neutral-800 rounded-xl p-5 flex items-center justify-between">
                            <div>
                              <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
                                Tu resultado · {activeResult.rx ? 'RX' : 'Scaled'}
                              </p>
                              <p className="text-white font-black text-2xl tracking-tight">
                                {getScoreDisplay(activeWod, activeResult)}
                              </p>
                              {activeResult.score_notes && (
                                <p className="text-neutral-600 text-xs font-mono mt-1">{activeResult.score_notes}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setModalWod(activeWod)}
                              className="text-white/40 hover:text-white/80 transition-colors text-xs flex items-center gap-1 font-mono"
                            >
                              ✏ <span>Editar</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setModalWod(activeWod)}
                            className="px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition self-start"
                          >
                            Registrar resultado
                          </button>
                        )
                      )}

                      {/* Editar WOD */}
                      <button
                        onClick={() => setEditingWod(activeWod)}
                        className="text-neutral-600 hover:text-white text-xs font-mono uppercase tracking-widest transition w-fit"
                      >
                        ✏ Editar WOD
                      </button>

                      {/* Borrar WOD */}
                      {deletingId === activeWod.id ? (
                        <div className="flex gap-3">
                          <button onClick={() => handleDelete(activeWod.id)} className="text-red-400 text-xs font-mono">Confirmar</button>
                          <button onClick={() => setDeletingId(null)} className="text-neutral-600 text-xs font-mono">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(activeWod.id)} className="text-neutral-700 hover:text-red-400 text-xs font-mono transition w-fit">
                          × Eliminar este WOD
                        </button>
                      )}

                      {/* Borrar día */}
                      {deletingDay ? (
                        <div className="flex gap-3">
                          <button onClick={handleDeleteDay} className="text-red-400 text-xs font-mono">Confirmar borrar día</button>
                          <button onClick={() => setDeletingDay(false)} className="text-neutral-600 text-xs font-mono">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingDay(true)} className="text-neutral-700 hover:text-red-400 text-xs font-mono transition w-fit">
                          × Borrar todos los WODs de este día
                        </button>
                      )}
                    </div>
                    <PRCalculator prs={prs} wodText={`${activeWod.title} ${activeWod.description ?? ''}`} />
                  </div>
                </div>
              </div>
            )}

            {/* Estado vacío: sin WODs y sin pending */}
            {dayWods.length === 0 && selectedBlock !== 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin entrenos este día</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {loadWeekOpen && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          variant="libre"
          forceMode="week"
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}

      {loadWodOpen && pendingBlock !== null && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          variant="libre"
          forceMode="day"
          onConfirm={async (parsed) => {
            const sorted = [...parsed].sort((a, b) => a.block - b.block)
            const renumbered = sorted.map((w, i) => ({ ...w, date: selectedDate, block: pendingBlock + i }))
            await handleLoadWeek(renumbered)
            setLoadWodOpen(false)
            setPendingBlock(null)
            setPendingMode(null)
            setSelectedBlock(pendingBlock)
          }}
          onClose={() => { setLoadWodOpen(false); setPendingMode('select') }}
        />
      )}

      {modalWod && (
        <ResultModal
          wod={modalWod}
          existing={results.find(r => r.wod_id === modalWod.id)}
          onClose={() => setModalWod(null)}
          onSaved={handleResultSaved}
        />
      )}
    </>
  )
}
