'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getWodsForWeek, getResultsForWods, upsertResult, getProfile, getWodRanking, maybeUpdatePR } from '@/lib/db'
import type { RankingEntry } from '@/lib/db'
import type { Wod, Result, WodType } from '@/lib/types'
import AppHeader from '@/components/AppHeader'

// ── Constants ──────────────────────────────────────────

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const WOD_TYPE_LABEL: Record<string, string> = {
  'For Time': 'FOR TIME',
  'AMRAP':    'AMRAP',
  'EMOM':     'EMOM',
  'Strength': 'STRENGTH',
  'Warmup':   'WARMUP',
  'For Max':  'FOR MAX',
  'Other':    'WOD',
}

// ── Helpers ────────────────────────────────────────────

function isSunday(date: string): boolean {
  return new Date(date + 'T00:00:00').getDay() === 0
}

function getWeekDates(offset = 0): string[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}

function formatWeekRange(dates: string[]): string {
  const from = new Date(dates[0] + 'T00:00:00')
  const to   = new Date(dates[6] + 'T00:00:00')
  return `${from.getDate()} – ${to.getDate()} ${to.toLocaleDateString('es-ES', { month: 'long' })}`
}

function getScoreDisplay(wod: Wod, result: Result): string {
  if (wod.type === 'For Time'                        && result.score_time)   return result.score_time
  if ((wod.type === 'AMRAP' || wod.type === 'EMOM')  && result.score_rounds) return result.score_rounds
  if (wod.type === 'Strength'                        && result.score_weight) return `${result.score_weight} kg`
  if (wod.type === 'For Max'                         && result.score_rounds) return result.score_rounds
  if (result.score_notes) return result.score_notes
  return '—'
}

// ── Ranking helpers ────────────────────────────────────

function parseTime(t: string): number {
  const m = t.match(/(\d+):(\d+)/)
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : Infinity
}

function parseAmrap(s: string): number {
  const m = s.match(/(\d+)\+(\d+)/)
  if (m) return parseInt(m[1]) * 10000 + parseInt(m[2])
  const n = parseInt(s)
  return isNaN(n) ? 0 : n * 10000
}

function parseNumber(s: string): number {
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : 0
}

function sortRanking(entries: RankingEntry[], type: WodType): RankingEntry[] {
  return [...entries].sort((a, b) => {
    switch (type) {
      case 'For Time':
        return parseTime(a.score_time ?? '') - parseTime(b.score_time ?? '')
      case 'AMRAP':
        return parseAmrap(b.score_rounds ?? '0') - parseAmrap(a.score_rounds ?? '0')
      case 'For Max':
        return parseNumber(b.score_rounds ?? '0') - parseNumber(a.score_rounds ?? '0')
      case 'Strength':
        return (b.score_weight ?? 0) - (a.score_weight ?? 0)
      case 'EMOM': {
        const wDiff = (b.score_weight ?? 0) - (a.score_weight ?? 0)
        if (wDiff !== 0) return wDiff
        return parseNumber(b.score_rounds ?? '0') - parseNumber(a.score_rounds ?? '0')
      }
      default: return 0
    }
  })
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

// ── Result Modal ───────────────────────────────────────

function ResultModal({ wod, existing, onClose, onSaved }: {
  wod:       Wod
  existing?: Result
  onClose:   () => void
  onSaved:   (result: Result, isNewPR: boolean) => void
}) {
  const [scoreTime,   setScoreTime]   = useState(existing?.score_time ?? '')
  const [scoreRounds, setScoreRounds] = useState(existing?.score_rounds          ?? '')
  const [scoreWeight, setScoreWeight] = useState(existing?.score_weight?.toString() ?? '')
  const [notes,       setNotes]       = useState(existing?.score_notes           ?? '')
  const [rx,          setRx]          = useState(existing?.rx ?? true)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await upsertResult({
        wod_id:       wod.id,
        score_time:   scoreTime   || null,
        score_rounds: scoreRounds || null,
        score_weight: scoreWeight ? parseFloat(scoreWeight) : null,
        score_notes:  notes       || null,
        rx,
      })

      let isNewPR = false
      if (wod.type === 'Strength' && scoreWeight && result.user_id) {
        const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })()
        const pr = await maybeUpdatePR(result.user_id, wod.title, parseFloat(scoreWeight), today, wod.id)
        isNewPR = pr.isNewPR
      }

      onSaved(result, isNewPR)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-6">

        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
              {WOD_TYPE_LABEL[wod.type] ?? wod.type}
            </p>
            <h2 className="text-white font-black text-xl tracking-tight uppercase">{wod.title}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {wod.type === 'For Time' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Tiempo (mm:ss)
              </label>
              <input
                type="text" placeholder="14:32" value={scoreTime}
                onChange={e => setScoreTime(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
              />
            </div>
          )}
          {(wod.type === 'AMRAP' || wod.type === 'EMOM') && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Rondas + reps
              </label>
              <input
                type="text" placeholder="7+15" value={scoreRounds}
                onChange={e => setScoreRounds(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
              />
            </div>
          )}
          {wod.type === 'For Max' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Reps / Calorías
              </label>
              <input
                type="text" placeholder="47 cals / 32 reps" value={scoreRounds}
                onChange={e => setScoreRounds(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
              />
            </div>
          )}
          {wod.type === 'Strength' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Peso (kg)
              </label>
              <input
                type="number" step="0.5" placeholder="102.5" value={scoreWeight}
                onChange={e => setScoreWeight(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
              />
            </div>
          )}
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
              Notas (opcional)
            </label>
            <textarea
              placeholder="Escalas usadas, sensaciones..." value={notes}
              onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none"
            />
          </div>

          <button type="button" onClick={() => setRx(!rx)} className="flex items-center gap-3 w-fit">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${rx ? 'bg-white border-white' : 'border-neutral-600'}`}>
              {rx && <span className="text-black text-xs font-black">✓</span>}
            </div>
            <span className="text-white text-sm font-medium">RX</span>
            <span className="text-neutral-500 text-xs font-mono">sin escalar</span>
          </button>

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all mt-2"
          >
            {loading ? 'Guardando...' : existing ? 'Actualizar resultado' : 'Guardar resultado'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Dashboard Page ─────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
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
  const [isCoach,         setIsCoach]         = useState(false)
  const [program,         setProgram]         = useState<'bizarro' | 'entrenemos'>('bizarro')
  const [generatingTimer, setGeneratingTimer] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Carga inicial: perfil
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      setIsCoach(profile?.role === 'coach')

      if (profile?.role === 'athlete' && !profile.program) {
        router.push('/elegir-programa')
        return
      }

      setProgram((profile?.program ?? 'bizarro') as 'bizarro' | 'entrenemos')
      setLoading(false)
    })
  }, [authLoading, user, router])

  // Carga WODs cuando cambia semana o programa
  useEffect(() => {
    if (loading || !program) return
    setWodLoading(true)
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

  // Reset block tab when day changes
  useEffect(() => { setSelectedBlock(0) }, [selectedDate])

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
    try {
      const res = await fetch('/api/generate-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wod),
      })
      const cfg = await res.json()
      if (cfg.error) return
      sessionStorage.setItem('generated_timer_config', JSON.stringify(cfg))
      router.push('/timer')
    } catch { /* ignore */ } finally {
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
            className="text-neutral-600 hover:text-white transition font-mono text-sm"
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

          {/* Block tabs — siempre 6 */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6].map((block) => {
              const wod      = dayWods.find(w => w.block === block)
              const isActive = selectedBlock === block - 1
              const label    = wod ? (WOD_TYPE_LABEL[wod.type] ?? wod.type) : `Bloque ${block}`
              return (
                <button
                  key={block}
                  onClick={() => setSelectedBlock(block - 1)}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                    isActive
                      ? 'bg-white text-black'
                      : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                >
                  {label}
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
              {!['Warmup', 'Strength'].includes(activeWod.type) && (
                <button
                  onClick={() => handleGenerateTimer(activeWod)}
                  disabled={generatingTimer}
                  className="w-full border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition mb-6 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generatingTimer ? 'Generando...' : '⚡ Generar timer'}
                </button>
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
                      className="text-neutral-600 hover:text-white text-sm font-mono transition"
                    >
                      Editar
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
