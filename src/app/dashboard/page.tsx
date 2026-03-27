'use client'


import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getWodsForWeek, getResultsForWods, getProfile, getMyPRs, getCoachMessage } from '@/lib/db'
import type { PersonalRecord, CoachMessage } from '@/lib/db'
import type { Wod, Result, Program } from '@/lib/types'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import ResultModal from '@/components/ResultModal'
import RankingSection from '@/components/RankingSection'
import PRCalculator from '@/components/PRCalculator'
import CoachMessageCard from '@/components/CoachMessageCard'
import CoachMessageBubble from '@/components/CoachMessageBubble'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL, getScoreDisplay } from '@/lib/wod-utils'

// ── Dashboard Page ─────────────────────────────────────

function DashboardContent() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const today = useMemo(() => getTodayStr(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(0)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [results,       setResults]       = useState<Result[]>([])
  const [loading,       setLoading]       = useState(true)
  const [wodLoading,    setWodLoading]    = useState(false)
  const [newPR,         setNewPR]         = useState<string | null>(null)
  const [rankingKey,    setRankingKey]    = useState(0)
  const [modalWod,      setModalWod]      = useState<Wod | null>(null)
  const searchParams = useSearchParams()
  const [prs,             setPrs]             = useState<PersonalRecord[]>([])
  const [isCoach,         setIsCoach]         = useState(false)
  const [program,         setProgram]         = useState<Program>('bizarro')
  const [generatingTimer, setGeneratingTimer] = useState(false)
  const [activeTab,       setActiveTab]       = useState<'wod' | 'ranking'>('wod')
  const [timerError,      setTimerError]      = useState(false)
  const [wodError,        setWodError]        = useState<string | null>(null)
  const [coachMessage,    setCoachMessage]    = useState<CoachMessage | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  // Carga inicial: perfil
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    Promise.all([getProfile(user.id), getMyPRs().catch(() => [])]).then(([profile, userPRs]) => {
      setIsCoach(profile?.role === 'coach')
      setPrs(userPRs)
      const programFromUrl = searchParams.get('program')
      const resolvedProgram = programFromUrl ?? profile?.program ?? null
      if (!resolvedProgram) { router.push('/elegir-modo'); return }
      setProgram(resolvedProgram as Program)
      setLoading(false)
    })
  }, [authLoading, user, router])

  // Carga WODs cuando cambia semana o programa
  useEffect(() => {
    if (loading || !program) return
    setWodLoading(true)
    setWodError(null)
    getCoachMessage(program, weekDates[0]).then(setCoachMessage).catch(() => setCoachMessage(null))
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
    setActiveTab('wod')
  }, [selectedDate, wods])

  function handleSaved(result: Result, isNewPR: boolean) {
    setResults(prev => {
      const idx = prev.findIndex(r => r.wod_id === result.wod_id)
      if (idx >= 0) { const u = [...prev]; u[idx] = result; return u }
      return [...prev, result]
    })
    setModalWod(null)
    setRankingKey(k => k + 1)
    if (isNewPR && activeWod) {
      setNewPR(activeWod.title)
      setTimeout(() => setNewPR(null), 4000)
    }
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

  const dayWods      = wods.filter(w => w.date === selectedDate)
  const activeWod    = dayWods.find(w => w.block === selectedBlock + 1) ?? null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  if (authLoading || loading) {
    return (
      <AthletePageLoading />
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
            className="text-neutral-600 hover:text-white transition font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                  onClick={() => setSelectedDate(date)}
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
        <div className="flex-1 flex flex-col lg:flex-row px-6 py-8 max-w-5xl mx-auto w-full gap-8">

          {/* Coach message — desktop */}
          {coachMessage && (
            <div className="hidden lg:block w-64 shrink-0 pt-0">
              <CoachMessageCard message={coachMessage} />
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">

          {wodError && (
            <p className="text-red-400 text-sm text-center py-4">{wodError}</p>
          )}

          {wodLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
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
                  onClick={() => { setSelectedBlock(wod.block - 1); setActiveTab('wod') }}
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
            <div className="flex-1 min-w-0">
              {/* Type badge / Ranking tabs */}
              <div className="flex items-center gap-2 mb-5">
                <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1">
                  <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                    {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                  </span>
                </div>
                {!['Warmup', 'Gymnastics', 'Core', 'Mobility', 'Other'].includes(activeWod.type) && (
                  <button
                    onClick={() => setActiveTab(t => t === 'ranking' ? 'wod' : 'ranking')}
                    className={`inline-flex items-center px-4 py-1 rounded-full text-xs uppercase tracking-widest font-mono transition border ${
                      activeTab === 'ranking'
                        ? 'bg-white text-black border-white'
                        : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    Ranking
                  </button>
                )}
              </div>

              {activeTab === 'ranking' ? (
                <RankingSection wod={activeWod} refreshKey={rankingKey} />
              ) : (
                <>
                {/* Title */}
                <h1 className="text-white font-black text-5xl sm:text-7xl leading-none tracking-tighter uppercase mb-8">
                  {activeWod.title}
                </h1>

                {/* Description + PRCalculator side by side from here */}
                <div className="flex gap-6 items-start">
                  <div className="flex-1 min-w-0">
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
                          className="w-full border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
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

                    {/* Result — oculto en bloques de Warmup */}
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
                  </div>
                  <PRCalculator prs={prs} wodText={`${activeWod.title} ${activeWod.description ?? ''}`} />
                </div>
                </>
              )}
            </div>
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
          </div>{/* end flex-1 inner */}

        </div>{/* end content outer */}

      <CoachMessageBubble message={coachMessage} />

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

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}
