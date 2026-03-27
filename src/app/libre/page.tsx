'use client'


import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import ResultModal from '@/components/ResultModal'
import LoadWeekModal from '@/components/LoadWeekModal'
import {
  getProfile, getWodsForWeekLibre, createLibreWod, deleteWod,
  getResultsForWods, getMyPRs,
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
  const [modalWod,       setModalWod]       = useState<Wod | null>(null)
  const [newPR,          setNewPR]          = useState<string | null>(null)
  const [generatingTimer, setGeneratingTimer] = useState(false)
  const [timerError,     setTimerError]     = useState(false)
  const [wodError,       setWodError]       = useState<string | null>(null)
  const [loadWeekOpen,   setLoadWeekOpen]   = useState(false)
  const [prs,            setPrs]            = useState<PersonalRecord[]>([])

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    Promise.all([getProfile(user.id), getMyPRs().catch(() => [])]).then(([profile, userPRs]) => {
      if (profile?.role === 'coach') { router.push('/select-program'); return }
      setPrs(userPRs)
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
  }, [weekOffset, weekDates, today])

  useEffect(() => {
    const firstBlock = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)[0]
    setSelectedBlock(firstBlock?.block ?? 1)
    setPendingBlock(null)
    setEditingWod(undefined)
  }, [selectedDate, wods])

  function handleWodSaved(wod: Wod) {
    setWods(prev => {
      const idx = prev.findIndex(w => w.id === wod.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = wod; return u }
      return [...prev, wod]
    })
    setSelectedBlock(wod.block)
    setPendingBlock(null)
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

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string; timerConfig?: import('@/lib/types').TimerConfig | null }[]) {
    if (!user) return
    for (const { date, block, title, type, description, timerConfig } of parsed) {
      const extra = timerConfig != null ? { timer_config: timerConfig } : {}
      try {
        await createLibreWod({ date, block, title, type, description, ...extra }, user.id)
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === '23505') continue
        throw err
      }
    }
    const updated = await getWodsForWeekLibre(user.id, weekDates[0], weekDates[6])
    setWods(updated)
  }

  async function handleGenerateTimer(wod: { title: string; description: string; type: string; timer_config?: import('@/lib/types').TimerConfig | null }) {
    if (wod.timer_config) {
      sessionStorage.setItem('generated_timer_config', JSON.stringify(wod.timer_config))
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

  const dayWods   = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
  const activeWod = pendingBlock === null ? (dayWods.find(w => w.block === selectedBlock) ?? null) : null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  if (authLoading || loading) {
    return (
      <AthletePageLoading />
    )
  }

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        <AppHeader homeRoute="/libre" />

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
            <button
              onClick={() => setLoadWeekOpen(true)}
              className="text-neutral-600 hover:text-white text-xs font-mono transition"
            >
              ↓ Cargar semana
            </button>
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
                  className={`flex-1 min-w-[3rem] flex flex-col items-center gap-1 px-1 sm:px-5 py-4 border-b-2 transition-colors ${isSelected ? 'border-white' : 'border-transparent'}`}
                >
                  <span className={`text-xs uppercase tracking-widest font-mono ${isSelected ? 'text-neutral-400' : 'text-neutral-700'}`}>
                    {DAY_SHORT[d.getDay()]}
                  </span>
                  <span className={`text-lg font-black leading-none ${isSelected ? 'text-white' : isToday ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {d.getDate()}
                  </span>
                  <div className={`w-1 h-1 rounded-full ${hasWod ? (isSelected ? 'bg-white' : 'bg-neutral-600') : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col px-6 py-8 max-w-2xl mx-auto w-full">

          {wodError && (
            <p className="text-red-400 text-sm text-center py-4">{wodError}</p>
          )}

          {isSunday(selectedDate) ? (
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
              <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">Descanso</h2>
            </div>
          ) : (<>

            {/* Block tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {dayWods.map(wod => (
                <button
                  key={wod.block}
                  onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null); setEditingWod(undefined) }}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                    selectedBlock === wod.block && pendingBlock === null && !editingWod
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
                  const next = dayWods.length > 0 ? Math.max(...dayWods.map(w => w.block)) + 1 : 1
                  setPendingBlock(next)
                  setSelectedBlock(next)
                  setEditingWod(undefined)
                }}
                className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition border border-dashed border-neutral-700 text-neutral-600 hover:border-neutral-500 hover:text-neutral-400"
              >
                + Bloque
              </button>
            </div>

            {/* Formulario nuevo bloque */}
            {(dayWods.length === 0 || pendingBlock !== null) && (
              <WodForm
                date={selectedDate}
                block={pendingBlock ?? 1}
                onSaved={handleWodSaved}
                onCancel={pendingBlock !== null && dayWods.length > 0 ? () => { setPendingBlock(null); setSelectedBlock(dayWods[0]?.block ?? 1) } : undefined}
              />
            )}

            {/* WOD activo */}
            {activeWod && !editingWod && (
              <div className="flex gap-6 items-start">
              <div className="flex flex-col gap-6 flex-1 min-w-0">
                <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1 w-fit">
                  <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                    {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                  </span>
                </div>

                <h1 className="text-white font-black text-5xl sm:text-6xl leading-none tracking-tighter uppercase">
                  {activeWod.title}
                </h1>

                <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                  {activeWod.description}
                </pre>

                {/* Generar timer */}
                {!['Warmup', 'Strength', 'Gymnastics'].includes(activeWod.type) && (
                  <div>
                    <button
                      onClick={() => handleGenerateTimer(activeWod)}
                      disabled={generatingTimer}
                      className="w-full border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-50"
                    >
                      {generatingTimer ? 'Generando...' : '⚡ Generar timer'}
                    </button>
                    {timerError && (
                      <p className="text-red-500 text-xs font-mono mt-2 text-center">Error al generar el timer.</p>
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
                      className="w-full bg-white text-black font-black text-lg uppercase tracking-widest rounded-xl px-6 py-5 hover:bg-neutral-100 active:scale-[0.98] transition-all"
                    >
                      Registrar resultado
                    </button>
                  )
                )}

                {/* Editar / Eliminar */}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setEditingWod(activeWod)}
                    className="flex-1 border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm"
                  >
                    Editar WOD
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
              </div>
              <PRCalculator prs={prs} wodText={`${activeWod.title} ${activeWod.description ?? ''}`} />
              </div>
            )}

            {/* Formulario editar WOD */}
            {activeWod && editingWod && (
              <WodForm
                date={selectedDate}
                block={editingWod.block}
                wod={editingWod}
                onSaved={wod => { handleWodSaved(wod); setEditingWod(undefined) }}
                onCancel={() => setEditingWod(undefined)}
              />
            )}

          </>)}
        </div>
      </main>

      {loadWeekOpen && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          variant="libre"
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
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
