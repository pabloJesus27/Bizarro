'use client'


import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getWodsForWeek, getResultsForWods, getProfile, getMyPRs, getCoachMessage, getMyOwnedCommunity, getMyAthletePrograms } from '@/lib/db'
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
import PesosTab from '@/components/comunidad/PesosTab'
import WelcomeModal from '@/components/WelcomeModal'

// ── Dashboard Page ─────────────────────────────────────

function DashboardContent() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const today = useMemo(() => getTodayStr(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(1)
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
  const [activeTab,       setActiveTab]       = useState<'wod' | 'ranking' | 'pesos'>('wod')
  const [timerError,      setTimerError]      = useState(false)
  const [wodError,        setWodError]        = useState<string | null>(null)
  const [coachMessage,    setCoachMessage]    = useState<CoachMessage | null>(null)
  const [communitySlug,   setCommunitySlug]   = useState<string | undefined>(undefined)
  const [showWelcome,     setShowWelcome]     = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const initPosRef = useRef<{ date: string; block: number } | null>(
    typeof window !== 'undefined'
      ? (() => { try { const s = sessionStorage.getItem('biz_dash_pos'); return s ? JSON.parse(s) : null } catch { return null } })()
      : null
  )
  const prevSelectedDateRef = useRef(today)
  const resultHandledRef = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    Promise.all([getProfile(user.id), getMyPRs().catch(() => []), getMyOwnedCommunity(user.id).catch(() => null), getMyAthletePrograms(user.id).catch(() => [])]).then(([profile, userPRs, community, myPrograms]) => {
      setIsCoach(profile?.role === 'coach')
      setPrs(userPRs)
      if (community) setCommunitySlug(community.slug)
      const programFromUrl = searchParams.get('program')
      const resolvedProgram = programFromUrl ?? profile?.program ?? null
      if (!resolvedProgram) { router.push('/elegir-modo'); return }

      // Verificar membresía (coaches pueden acceder a cualquier programa, libre no requiere membresía)
      if (profile?.role !== 'coach' && resolvedProgram !== 'libre') {
        const isMember = (myPrograms as { programs: { slug: string } }[]).some(ap => ap.programs.slug === resolvedProgram)
        if (!isMember) { router.push('/elegir-modo'); return }
      }

      setProgram(resolvedProgram as Program)
      setLoading(false)
      if (profile?.role !== 'coach') {
        const key = `bizarro_welcome_v1_${user.id}`
        if (!localStorage.getItem(key)) setShowWelcome(true)
      }
    })
  }, [authLoading, user, router])

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

  useEffect(() => {
    setSelectedDate(weekOffset === 0 ? today : weekDates[0])
    setSelectedBlock(1)
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
      setSelectedBlock(prev => {
        const exists = prev > 0 && wods.some(w => w.date === selectedDate && w.block === prev)
        return exists ? prev : (firstBlock?.block ?? 1)
      })
    }
    setActiveTab('wod')
  }, [selectedDate, wods])

  useEffect(() => {
    sessionStorage.setItem('biz_dash_pos', JSON.stringify({ date: selectedDate, block: selectedBlock }))
  }, [selectedDate, selectedBlock])


  useEffect(() => {
    if (resultHandledRef.current) return
    const resultWodId = searchParams.get('result')
    if (!resultWodId || wods.length === 0) return
    const wod = wods.find(w => w.id === resultWodId)
    if (wod) {
      resultHandledRef.current = true
      setModalWod(wod)
      window.history.replaceState(null, '', '/dashboard')
    }
  }, [wods, searchParams])

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

  async function handleGenerateTimer(wod: { id?: string; title: string; description: string; type: string; timer_config?: import('@/lib/types').TimerConfig | null }) {
    if (wod.id) sessionStorage.setItem('timer_return_context', JSON.stringify({ wodId: wod.id, returnUrl: '/dashboard' }))
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

  const dayWods   = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
  const activeWod = dayWods.find(w => w.block === selectedBlock) ?? null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined
  const prCalcWodText = activeWod ? `${activeWod.title} ${activeWod.description ?? ''}` : ''

  if (authLoading || loading) return <AthletePageLoading />

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        <AppHeader communitySlug={communitySlug} showCommunityTab={!!communitySlug} />

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
                  onClick={() => { setSelectedDate(d); setSelectedBlock(1); setActiveTab('wod') }}
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

        {wodLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" />
              <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        ) : isSunday(selectedDate) ? (
          <div className="flex-1 flex flex-col justify-center px-6">
            <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
            <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">Descanso</h2>
          </div>
        ) : dayWods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin entrenos este día</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 lg:flex-row">

            {/* Panel izquierdo: lista de bloques */}
            <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden">
              {dayWods.map(wod => {
                const result   = results.find(r => r.wod_id === wod.id)
                const isActive = wod.block === selectedBlock
                return (
                  <button
                    key={wod.id}
                    onClick={() => { setSelectedBlock(wod.block); setActiveTab('wod') }}
                    className={`flex-shrink-0 text-left px-6 py-4 border-r lg:border-r-0 lg:border-b border-neutral-900 transition ${
                      isActive ? 'bg-neutral-900' : 'hover:bg-neutral-950'
                    }`}
                  >
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[wod.type] ?? wod.type}
                    </p>
                    <p className="text-white font-black text-sm">{wod.title}</p>
                    {result && (
                      <p className="text-neutral-400 text-xs font-mono mt-1">{getScoreDisplay(wod, result)}</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Panel derecho: detalle del WOD */}
            {activeWod && (
              <div className="flex-1 flex flex-col min-w-0">

                {/* Tabs */}
                <div className="flex border-b border-neutral-900 px-6">
                  <button
                    onClick={() => setActiveTab('wod')}
                    className={`py-3 mr-6 text-xs font-mono uppercase tracking-widest border-b-2 transition ${
                      activeTab === 'wod' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    WOD
                  </button>
                  {!['Warmup', 'Gymnastics', 'Core', 'Mobility', 'Other'].includes(activeWod.type) && (
                    <button
                      onClick={() => setActiveTab('ranking')}
                      className={`py-3 mr-6 text-xs font-mono uppercase tracking-widest border-b-2 transition ${
                        activeTab === 'ranking' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Ranking
                    </button>
                  )}
                  {activeWod.type === 'Strength' && /\d+\s*%/.test(activeWod.description ?? '') && (
                    <button
                      onClick={() => setActiveTab('pesos')}
                      className={`py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition ${
                        activeTab === 'pesos' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Pesos
                    </button>
                  )}
                </div>

                {activeTab === 'ranking' ? (
                  <div className="flex-1 p-6">
                    <RankingSection wod={activeWod} refreshKey={rankingKey} />
                  </div>
                ) : activeTab === 'pesos' ? (
                  <PesosTab
                    wodText={`${activeWod.title} ${activeWod.description ?? ''}`}
                    programSlug={program}
                    session={session}
                    endpoint="/api/program-prs"
                  />
                ) : (
                  <div className="flex-1 p-6 relative">
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                    </p>
                    <h2 className="text-white font-black text-2xl tracking-tight mb-4">{activeWod.title}</h2>

                    {activeWod.description && (
                      <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                        {activeWod.description}
                      </pre>
                    )}
                    <PRCalculator prs={prs} wodText={prCalcWodText} />

                    {/* Generar timer */}
                    {!['Warmup', 'Strength', 'Gymnastics'].includes(activeWod.type) && (
                      <div className="mt-6">
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
                      <div className="mt-6">
                        {activeResult ? (
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
                            className="px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition w-full"
                          >
                            Registrar resultado
                          </button>
                        )}
                      </div>
                    )}

                    {/* Coach message — desktop */}
                    {coachMessage && (
                      <div className="hidden lg:block mt-8">
                        <CoachMessageCard message={coachMessage} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

      {showWelcome && (
        <WelcomeModal
          mode="program"
          onClose={() => {
            localStorage.setItem(`bizarro_welcome_v1_${user!.id}`, '1')
            setShowWelcome(false)
          }}
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
