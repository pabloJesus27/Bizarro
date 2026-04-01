'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import ResultModal from '@/components/ResultModal'
import RankingSection from '@/components/RankingSection'
import LoadWeekModal from '@/components/LoadWeekModal'
import WodModal from '@/components/admin/WodModal'
import PRCalculator from '@/components/PRCalculator'
import PesosTab from '@/components/comunidad/PesosTab'
import {
  getCommunityInfo, getMyCommunityMembership,
  getWodsForCommunity, getResultsForWods, createWod,
  deleteWod, deleteWodsForDay, deleteWodsForWeek,
  getMyPRs,
} from '@/lib/db'
import type { CommunityMembership, PersonalRecord } from '@/lib/db'
import type { Community } from '@/lib/types'
import type { Wod, Result } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL, getScoreDisplay, detectPRExercise } from '@/lib/wod-utils'

export default function ComunidadPage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  const today = useMemo(() => getTodayStr(), [])

  const [community,     setCommunity]     = useState<Community | null>(null)
  const [membership,    setMembership]    = useState<CommunityMembership | null>(null)
  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(1)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [results,       setResults]       = useState<Result[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalWod,      setModalWod]      = useState<Wod | null>(null)
  const [rankingKey,    setRankingKey]    = useState(0)
  const [loadWeekOpen,  setLoadWeekOpen]  = useState(false)
  const [activeTab,     setActiveTab]     = useState<'wod' | 'ranking' | 'pesos'>('wod')
  const [wodError,      setWodError]      = useState<string | null>(null)
  const [prs,              setPrs]              = useState<PersonalRecord[]>([])
  const [editingWod,       setEditingWod]       = useState<Wod | null>(null)
  const [pendingBlock,     setPendingBlock]     = useState<number | null>(null)
  const [pendingMode,      setPendingMode]      = useState<'select' | 'manual' | null>(null)
  const [loadWodOpen,      setLoadWodOpen]      = useState(false)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [deletingDay,      setDeletingDay]      = useState(false)
  const [deletingWeek,     setDeletingWeek]     = useState(false)
  const [generatingTimer,  setGeneratingTimer]  = useState(false)
  const [timerError,       setTimerError]       = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const initPosRef = useRef<{ date: string; block: number } | null>(
    typeof window !== 'undefined'
      ? (() => { try { const s = sessionStorage.getItem(`biz_com_${slug}_pos`); return s ? JSON.parse(s) : null } catch { return null } })()
      : null
  )
  const prevSelectedDateRef = useRef(today)

  const isOwner = !!user && community?.owner_id === user.id

  // Carga inicial: comunidad + membresía
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getMyPRs().catch(() => []).then(setPrs)

    getCommunityInfo(slug).then(async c => {
      if (!c) { router.push('/elegir-modo'); return }
      setCommunity(c)

      const m = await getMyCommunityMembership(c.id, user.id)
      if (!m) { router.push('/elegir-modo'); return }
      setMembership(m)
      setLoading(false)
    })
  }, [authLoading, user, slug, router])

  // Carga de WODs por semana
  useEffect(() => {
    if (loading || !community || !membership) return
    setWodError(null)
    const joinedAt = isOwner ? undefined : membership.joined_at
    getWodsForCommunity(slug, weekDates[0], weekDates[6], joinedAt)
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
  }, [weekDates, loading, community, membership, slug, isOwner])

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
    setPendingBlock(null)
    setPendingMode(null)
  }, [selectedDate, wods])

  useEffect(() => {
    sessionStorage.setItem(`biz_com_${slug}_pos`, JSON.stringify({ date: selectedDate, block: selectedBlock }))
  }, [selectedDate, selectedBlock, slug])

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

  async function handleDelete(id: string) {
    await deleteWod(id)
    setWods(prev => prev.filter(w => w.id !== id))
    setDeletingId(null)
  }

  async function handleDeleteDay() {
    await deleteWodsForDay(selectedDate, slug)
    setWods(prev => prev.filter(w => w.date !== selectedDate))
    setDeletingDay(false)
  }

  async function handleDeleteWeek() {
    await deleteWodsForWeek(weekDates[0], weekDates[6], slug)
    setWods([])
    setDeletingWeek(false)
  }

  async function handleLoadSingleWod(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string; timerConfig?: import('@/lib/types').TimerConfig | null }[]) {
    const item = parsed[0]
    if (!item || pendingBlock === null) return
    const tc = Array.isArray(item.timerConfig) ? { type: 'mix' as const, blocks: item.timerConfig } : item.timerConfig
    const extra = tc != null ? { timer_config: tc } : {}
    const saved = await createWod({ date: selectedDate, block: pendingBlock, title: item.title, type: item.type, description: item.description, program: slug, ...extra })
    setWods(prev => [...prev, saved])
    setSelectedBlock(pendingBlock)
    setPendingBlock(null)
    setPendingMode(null)
  }

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string; timerConfig?: import('@/lib/types').TimerConfig | null }[]) {
    if (parsed.length > 0) {
      const dates = parsed.map(w => w.date).sort()
      await deleteWodsForWeek(dates[0], dates[dates.length - 1], slug)
    }
    for (const { date, block, title, type, description, timerConfig } of parsed) {
      const tc = Array.isArray(timerConfig) ? { type: 'mix' as const, blocks: timerConfig } : timerConfig
      const extra = tc != null ? { timer_config: tc } : {}
      await createWod({ date, block, title, type, description, program: slug, ...extra })
    }
    const joinedAt = isOwner ? undefined : membership?.joined_at
    const updated = await getWodsForCommunity(slug, weekDates[0], weekDates[6], joinedAt)
    setWods(updated)
  }

  function handleResultSaved(result: Result, _isNewPR: boolean) {
    setResults(prev => {
      const idx = prev.findIndex(r => r.wod_id === result.wod_id)
      if (idx >= 0) { const u = [...prev]; u[idx] = result; return u }
      return [...prev, result]
    })
    setModalWod(null)
    setRankingKey(k => k + 1)
  }

  const dayWods   = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)
  const activeWod = dayWods.find(w => w.block === selectedBlock) ?? null
  const activeResult = activeWod ? results.find(r => r.wod_id === activeWod.id) : undefined

  if (authLoading || loading) return <AthletePageLoading />

  return (
    <>
      <main className="min-h-screen bg-black flex flex-col">

        <AppHeader homeRoute={`/comunidad/${slug}`} communitySlug={slug} leftTitle={community?.name} />

        {/* Navegación de semana */}
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
            {isOwner && (wods.length > 0 ? (deletingWeek ? (
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
            ))}
          </div>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="text-neutral-600 hover:text-white transition font-mono text-sm"
          >
            siguiente →
          </button>
        </div>


        {/* Días de la semana */}
        <div className="border-b border-neutral-900 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-full gap-1 px-6 pt-2 pb-4">
          {weekDates.map(d => {
            if (isSunday(d)) return null
            const hasWods = wods.some(w => w.date === d)
            const isSelected = d === selectedDate
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
                <span className={`text-sm font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                  {new Date(d + 'T12:00:00').getDate()}
                </span>
                {hasWods && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-black' : 'bg-neutral-600'}`} />}
              </button>
            )
          })}
          </div>
        </div>

        {wodError && (
          <div className="px-6 py-4 text-red-400 text-xs font-mono">{wodError}</div>
        )}

        {/* Bloques del día */}
        {dayWods.length === 0 && !isOwner ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin entrenos este día</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 lg:flex-row">

            {/* Panel izquierdo: selector de bloque */}
            <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden">
              {dayWods.map(wod => {
                const result = results.find(r => r.wod_id === wod.id)
                const isActive = wod.block === selectedBlock && selectedBlock > 0 && activeTab === 'wod'
                return (
                  <button
                    key={wod.id}
                    onClick={() => { setSelectedBlock(wod.block); setActiveTab('wod'); setPendingBlock(null); setPendingMode(null) }}
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
              {isOwner && (
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
              )}
            </div>

            {/* Panel derecho: selector de modo */}
            {selectedBlock === 0 && pendingMode === 'select' && isOwner && (
              <div className="flex-1 p-6 flex flex-col gap-4">
                <p className="text-neutral-500 text-sm font-mono">¿Cómo quieres añadir el bloque?</p>
                {([
                  { key: 'manual', label: 'Escribir manualmente', desc: 'Rellena el formulario' },
                  { key: 'image', label: 'Cargar desde imagen', desc: 'La IA lee el WOD de una foto' },
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
                <button
                  onClick={() => { setPendingBlock(null); setPendingMode(null) }}
                  className="text-neutral-600 hover:text-white text-xs font-mono transition"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Panel derecho: formulario manual */}
            {selectedBlock === 0 && pendingMode === 'manual' && isOwner && (
              <div className="flex-1 p-6">
                <WodModal
                  inline
                  date={selectedDate}
                  block={pendingBlock!}
                  program={slug}
                  onClose={() => { setPendingBlock(null); setPendingMode(null); setSelectedBlock(dayWods[0]?.block ?? 1) }}
                  onSaved={saved => {
                    setWods(prev => [...prev, saved])
                    setPendingBlock(null)
                    setPendingMode(null)
                    setSelectedBlock(saved.block)
                  }}
                />
              </div>
            )}
            {!activeWod && selectedBlock !== 0 && isOwner && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Pulsa + Añadir bloque para empezar</p>
              </div>
            )}
            {activeWod && selectedBlock > 0 && (
              <div className="flex-1 flex flex-col">

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
                  <button
                    onClick={() => setActiveTab('ranking')}
                    className={`py-3 mr-6 text-xs font-mono uppercase tracking-widest border-b-2 transition ${
                      activeTab === 'ranking' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Ranking
                  </button>
                  {detectPRExercise(`${activeWod.title} ${activeWod.description ?? ''}`) && /\d+\s*%/.test(activeWod.description ?? '') && (
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

                {activeTab === 'wod' && (
                  <div className="flex-1 p-6">
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                    </p>
                    <h2 className="text-white font-black text-2xl tracking-tight mb-4">{activeWod.title}</h2>
                    <div className="flex gap-6 items-start">
                    <div className="flex-1 min-w-0">
                    {activeWod.description && (
                      <p className="text-neutral-300 text-sm font-mono whitespace-pre-wrap mb-6">{activeWod.description}</p>
                    )}
                    {!['Warmup', 'Strength', 'Gymnastics'].includes(activeWod.type) && (
                      <div className="mb-4">
                        <button
                          onClick={() => handleGenerateTimer(activeWod)}
                          disabled={generatingTimer}
                          className="border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-50"
                        >
                          {generatingTimer ? 'Generando...' : '⚡ Generar timer'}
                        </button>
                        {timerError && (
                          <p className="text-red-500 text-xs font-mono mt-2 text-center">Error al generar el timer.</p>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => setModalWod(activeWod)}
                      className="px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition"
                    >
                      {activeResult ? 'Editar resultado' : 'Registrar resultado'}
                    </button>
                    {activeResult && (
                      <p className="text-neutral-400 text-xs font-mono mt-3">
                        Tu resultado: {getScoreDisplay(activeWod, activeResult)}
                        {activeResult.rx && ' · RX'}
                      </p>
                    )}

                    {/* Borrar WOD + día (solo owner) */}
                    {isOwner && (
                      <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-neutral-900">
                        <button onClick={() => setEditingWod(activeWod)} className="text-neutral-700 hover:text-white text-xs font-mono transition w-fit">
                          ✎ Editar WOD
                        </button>
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
                    )}
                    </div>{/* end flex-1 */}
                    <PRCalculator prs={prs} wodText={`${activeWod.title} ${activeWod.description ?? ''}`} />
                    </div>{/* end flex gap-6 */}
                  </div>
                )}

                {activeTab === 'ranking' && (
                  <div className="flex-1 p-6">
                    <RankingSection wod={activeWod} refreshKey={rankingKey} />
                  </div>
                )}

                {activeTab === 'pesos' && (
                  <PesosTab
                    wodText={`${activeWod.title} ${activeWod.description ?? ''}`}
                    communitySlug={slug}
                    session={session}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {modalWod && (
        <ResultModal
          wod={modalWod}
          existing={results.find(r => r.wod_id === modalWod.id)}
          onSaved={handleResultSaved}
          onClose={() => setModalWod(null)}
        />
      )}

      {editingWod && isOwner && (
        <WodModal
          date={editingWod.date}
          block={editingWod.block}
          wod={editingWod}
          program={slug}
          onClose={() => setEditingWod(null)}
          onSaved={saved => {
            setWods(prev => prev.map(w => w.id === saved.id ? saved : w))
            setEditingWod(null)
          }}
        />
      )}

      {loadWeekOpen && isOwner && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          programSlug={slug}
          variant="libre"
          forceMode="week"
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}

      {loadWodOpen && isOwner && selectedBlock === 0 && pendingBlock !== null && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          variant="libre"
          forceMode="day"
          onConfirm={async (parsed) => {
            const sorted = [...parsed].sort((a, b) => a.block - b.block)
            const firstBlock = pendingBlock
            const newWods: import('@/lib/types').Wod[] = []
            for (let i = 0; i < sorted.length; i++) {
              const item = sorted[i]
              const tc = Array.isArray(item.timerConfig) ? { type: 'mix' as const, blocks: item.timerConfig } : item.timerConfig
              const extra = tc != null ? { timer_config: tc } : {}
              const saved = await createWod({ date: selectedDate, block: firstBlock + i, title: item.title, type: item.type, description: item.description, program: slug, ...extra })
              newWods.push(saved)
            }
            setWods(prev => [...prev, ...newWods])
            setSelectedBlock(firstBlock)
            setPendingBlock(null)
            setPendingMode(null)
            setLoadWodOpen(false)
          }}
          onClose={() => { setLoadWodOpen(false); setPendingMode('select') }}
        />
      )}
    </>
  )
}
