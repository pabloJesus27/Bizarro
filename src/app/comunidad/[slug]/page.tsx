'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AppHeader from '@/components/AppHeader'
import { AthletePageLoading } from '@/components/PageLoading'
import ResultModal from '@/components/ResultModal'
import RankingSection from '@/components/RankingSection'
import LoadWeekModal from '@/components/LoadWeekModal'
import {
  getCommunityInfo, getMyCommunityMembership,
  getWodsForCommunity, getResultsForWods, createWod,
} from '@/lib/db'
import type { CommunityMembership } from '@/lib/db'
import type { Community } from '@/lib/types'
import type { Wod, Result } from '@/lib/types'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange, getTodayStr } from '@/lib/week-utils'
import { WOD_TYPE_LABEL, getScoreDisplay } from '@/lib/wod-utils'

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
  const [activeTab,     setActiveTab]     = useState<'wod' | 'ranking'>('wod')
  const [wodError,      setWodError]      = useState<string | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  const isOwner = !!user && community?.owner_id === user.id

  // Carga inicial: comunidad + membresía
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

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
    const firstBlock = wods.filter(w => w.date === selectedDate).sort((a, b) => a.block - b.block)[0]
    setSelectedBlock(firstBlock?.block ?? 1)
  }, [selectedDate, wods])

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string; timerConfig?: import('@/lib/types').TimerConfig | null }[]) {
    for (const { date, block, title, type, description, timerConfig } of parsed) {
      const tc = Array.isArray(timerConfig) ? { type: 'mix' as const, blocks: timerConfig } : timerConfig
      const extra = tc != null ? { timer_config: tc } : {}
      try {
        await createWod({ date, block, title, type, description, program: slug, ...extra })
      } catch (err: unknown) {
        if ((err as { code?: string })?.code === '23505') continue
        throw err
      }
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
            {isOwner && (
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

        {/* Cabecera de comunidad */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">{community?.name}</p>
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
        {dayWods.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-700 text-xs font-mono uppercase tracking-widest">Sin entrenos este día</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 lg:flex-row">

            {/* Panel izquierdo: selector de bloque */}
            <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-900 flex lg:flex-col overflow-x-auto lg:overflow-x-hidden">
              {dayWods.map(wod => {
                const result = results.find(r => r.wod_id === wod.id)
                const isActive = wod.block === selectedBlock && activeTab === 'wod'
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

            {/* Panel derecho: WOD detail */}
            {activeWod && (
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
                    className={`py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition ${
                      activeTab === 'ranking' ? 'border-white text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Ranking
                  </button>
                </div>

                {activeTab === 'wod' && (
                  <div className="flex-1 p-6">
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-1">
                      {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                    </p>
                    <h2 className="text-white font-black text-2xl tracking-tight mb-4">{activeWod.title}</h2>
                    {activeWod.description && (
                      <p className="text-neutral-300 text-sm font-mono whitespace-pre-wrap mb-6">{activeWod.description}</p>
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
                  </div>
                )}

                {activeTab === 'ranking' && (
                  <div className="flex-1 p-6">
                    <RankingSection wod={activeWod} refreshKey={rankingKey} />
                  </div>
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

      {loadWeekOpen && isOwner && (
        <LoadWeekModal
          weekDates={weekDates}
          selectedDate={selectedDate}
          programSlug={slug}
          variant="libre"
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}
    </>
  )
}
