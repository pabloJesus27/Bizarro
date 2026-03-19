'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getWodsForWeek, getResultsForWods, getProfile, getWodRanking } from '@/lib/db'
import type { RankingEntry } from '@/lib/db'
import type { Wod, Result, WodType } from '@/lib/types'
import AppHeader from '@/components/AppHeader'
import ResultModal from '@/components/ResultModal'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange } from '@/lib/week-utils'
import { sortRanking } from '@/lib/wod-utils'

const WOD_TYPE_LABEL: Record<string, string> = {
  'For Time':   'FOR TIME',
  'AMRAP':      'AMRAP',
  'EMOM':       'EMOM',
  'Strength':   'STRENGTH',
  'Gymnastics': 'GYMNASTICS',
  'Warmup':     'WARMUP',
  'For Max':    'FOR MAX',
  'Other':      'WOD',
}

// ── Helpers ────────────────────────────────────────────

function getScoreDisplay(wod: Wod, result: Result): string {
  if (wod.type === 'For Time'                        && result.score_time)   return result.score_time
  if ((wod.type === 'AMRAP' || wod.type === 'EMOM')  && result.score_rounds) return result.score_rounds
  if (wod.type === 'Strength'                        && result.score_weight) return `${result.score_weight} kg`
  if (wod.type === 'For Max'                         && result.score_rounds) return result.score_rounds
  if (result.score_notes) return result.score_notes
  return '—'
}

function formatScore(entry: RankingEntry, type: WodType): string {
  switch (type) {
    case 'For Time':  return entry.score_time   ?? '—'
    case 'AMRAP':     return entry.score_rounds  ?? '—'
    case 'For Max':   return entry.score_rounds  ?? '—'
    case 'Strength':  return entry.score_weight != null ? `${entry.score_weight} kg` : '—'
    case 'EMOM': {
      const parts = []
      if (entry.score_weight) parts.push(`${entry.score_weight} kg`)
      if (entry.score_rounds) parts.push(entry.score_rounds)
      return parts.join(' · ') || '—'
    }
    default: return entry.score_notes ?? '—'
  }
}

function RankingSection({ wod }: { wod: Wod }) {
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getWodRanking(wod.id)
      .then(data => setEntries(sortRanking(data, wod.type)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [wod.id, wod.type])

  if (loading) return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Cargando ranking...</p>
    </div>
  )

  if (entries.length === 0) return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono">Sin resultados aún</p>
    </div>
  )

  return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-5">
        Ranking · {entries.length} {entries.length === 1 ? 'atleta' : 'atletas'}
      </p>
      <div className="flex flex-col gap-3">
        {entries.map((entry, i) => {
          const pos   = i + 1
          const name  = entry.profiles?.full_name ?? 'Atleta'
          const score = formatScore(entry, wod.type)
          const posLabel = pos.toString().padStart(2, '0')
          return (
            <div key={entry.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl ${pos === 1 ? 'border border-neutral-700 bg-neutral-950' : 'border border-neutral-900'}`}>
              <span className={`font-black font-mono text-sm w-6 ${pos === 1 ? 'text-white' : 'text-neutral-600'}`}>
                {posLabel}
              </span>
              <span className={`flex-1 font-medium text-sm ${pos === 1 ? 'text-white' : 'text-neutral-400'}`}>
                {name}
              </span>
              <span className={`font-black font-mono text-sm ${pos === 1 ? 'text-white' : 'text-neutral-400'}`}>
                {score}
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${entry.rx ? 'border-neutral-700 text-neutral-400' : 'border-neutral-800 text-neutral-600'}`}>
                {entry.rx ? 'RX' : 'SC'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Dashboard Page ─────────────────────────────────────

export default function DashboardPage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const today = useMemo(() => (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(0)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [results,       setResults]       = useState<Result[]>([])
  const [loading,       setLoading]       = useState(true)
  const [wodLoading,    setWodLoading]    = useState(false)
  const [newPR,         setNewPR]         = useState<string | null>(null)
  const [modalWod,      setModalWod]      = useState<Wod | null>(null)
  const searchParams = useSearchParams()
  const [isCoach,         setIsCoach]         = useState(false)
  const [program,         setProgram]         = useState<string>('bizarro')
  const [generatingTimer, setGeneratingTimer] = useState(false)
  const [timerError,      setTimerError]      = useState(false)
  const [wodError,        setWodError]        = useState<string | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Carga inicial: perfil
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      setIsCoach(profile?.role === 'coach')
      const programFromUrl = searchParams.get('program')
      const resolvedProgram = programFromUrl ?? profile?.program ?? null
      if (!resolvedProgram) { router.push('/elegir-modo'); return }
      setProgram(resolvedProgram)
      setLoading(false)
    })
  }, [authLoading, user, router])

  // Carga WODs cuando cambia semana o programa
  useEffect(() => {
    if (loading || !program) return
    setWodLoading(true)
    setWodError(null)
    getWodsForWeek(weekDates[0], weekDates[6], program)
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
      .finally(() => setWodLoading(false))
  }, [weekDates, program, loading])

  // Al cambiar de semana, seleccionar el lunes (o hoy si es la semana actual)
  useEffect(() => {
    if (weekOffset === 0) {
      setSelectedDate(today)
    } else {
      setSelectedDate(weekDates[0])
    }
    setSelectedBlock(0)
  }, [weekOffset, weekDates, today])

  // Reset block tab when day changes — seleccionar el primer bloque disponible
  useEffect(() => {
    const firstBlock = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)[0]
    setSelectedBlock(firstBlock ? firstBlock.block - 1 : 0)
  }, [selectedDate, wods])

  function handleSaved(result: Result, isNewPR: boolean) {
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

  async function handleGenerateTimer(wod: { title: string; description: string; type: string }) {
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

  const dayWods      = wods.filter(w => w.date === selectedDate)
  const activeWod    = dayWods.find(w => w.block === selectedBlock + 1) ?? null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        <AppHeader />

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
            className="text-neutral-600 hover:text-white transition font-mono text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← anterior
          </button>
          <span className="text-neutral-400 text-xs font-mono uppercase tracking-widest">
            {formatWeekRange(weekDates)}
          </span>
          <button
            onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
            disabled={weekOffset === 0}
            className="text-neutral-600 hover:text-white transition font-mono text-sm disabled:opacity-30"
          >
            siguiente →
          </button>
        </div>

        {/* Week tabs */}
        <div className="border-b border-neutral-900">
          <div className="grid grid-cols-7">
            {weekDates.map((date) => {
              const d          = new Date(date + 'T00:00:00')
              const isToday    = date === today
              const isSelected = date === selectedDate
              const hasWod     = wods.some(w => w.date === date)

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center gap-1 px-5 py-4 border-b-2 transition-colors ${
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

          {wodError && (
            <p className="text-red-400 text-sm text-center py-4">{wodError}</p>
          )}

          {wodLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-px h-10 bg-white animate-pulse" />
            </div>
          ) : isSunday(selectedDate) ? (
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
              <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">
                Descanso
              </h2>
            </div>
          ) : (<>

          {/* Block tabs — solo bloques con contenido */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {dayWods.map((wod) => {
              const isActive = selectedBlock === wod.block - 1
              return (
                <button
                  key={wod.block}
                  onClick={() => setSelectedBlock(wod.block - 1)}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                    isActive
                      ? 'bg-white text-black'
                      : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                </button>
              )
            })}
          </div>

          {activeWod ? (
            <>
              {/* Type badge */}
              <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1 mb-5 w-fit">
                <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                  {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-white font-black text-5xl sm:text-7xl leading-none tracking-tighter uppercase mb-8">
                {activeWod.title}
              </h1>

              {/* Description */}
              <pre className="text-neutral-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5 mb-12">
                {activeWod.description}
              </pre>

              {/* Generar timer */}
              {!['Warmup', 'Strength', 'Gymnastics'].includes(activeWod.type) && (
                <div className="mb-6">
                  <button
                    onClick={() => handleGenerateTimer(activeWod)}
                    disabled={generatingTimer}
                    className="w-full border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generatingTimer ? 'Generando...' : '⚡ Generar timer'}
                  </button>
                  {timerError && (
                    <p className="text-red-500 text-xs font-mono mt-2 text-center">
                      No se pudo generar el temporizador. Inténtalo de nuevo.
                    </p>
                  )}
                </div>
              )}

              {/* Result + Ranking — oculto en bloques de Warmup */}
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

              {activeWod.type !== 'Warmup' && <RankingSection wod={activeWod} />}
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center pt-8">
              <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-3">Bloque {selectedBlock + 1}</p>
              <h2 className="text-neutral-800 font-black text-4xl uppercase tracking-tighter leading-none">
                Sin programar
              </h2>
            </div>
          )}
          </>)}
          </div>

      </main>

      {modalWod && (
        <ResultModal
          wod={modalWod}
          existing={results.find(r => r.wod_id === modalWod.id)}
          onClose={() => setModalWod(null)}
          onSaved={handleSaved}
        />
      )}

    </>
  )
}
