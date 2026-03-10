'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { getProfile, getWodsForWeek, createWod, updateWod, deleteWod, getWodRanking, createCoachInvite, getMyPrograms } from '@/lib/db'
import LoadWeekModal from '@/components/LoadWeekModal'
import type { RankingEntry } from '@/lib/db'
import type { Wod, WodType } from '@/lib/types'

// ── Constants ──────────────────────────────────────────

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const WOD_TYPES: WodType[] = ['Warmup', 'Strength', 'Gymnastics', 'For Time', 'AMRAP', 'EMOM', 'For Max', 'Other']

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

// ── Week utils ─────────────────────────────────────────

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

// ── WOD Form Modal ─────────────────────────────────────

function WodModal({ date, block, wod, onClose, onSaved, inline = false, program = 'bizarro' }: {
  date:     string
  block:    number
  wod?:     Wod
  onClose:  () => void
  onSaved:  (wod: Wod) => void
  inline?:  boolean
  program?: string
}) {
  const [title,       setTitle]       = useState(wod?.title       ?? '')
  const [type,        setType]        = useState<WodType>(wod?.type ?? 'For Time')
  const [description, setDescription] = useState(wod?.description ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const isEdit = !!wod

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es obligatorio'); return }
    setError('')
    setLoading(true)
    try {
      const saved = isEdit
        ? await updateWod(wod.id, { title, type, description })
        : await createWod({ date, block, title, type, description, program: program as import('@/lib/types').Program })
      onSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const dayFormatted = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const formContent = (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
            {dayFormatted} · Bloque {block}
          </p>
          <h2 className="text-white font-black text-xl tracking-tight uppercase">
            {isEdit ? 'Editar WOD' : 'Nuevo WOD'}
          </h2>
        </div>
        {!inline && (
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">
            &times;
          </button>
        )}
      </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
              Tipo
            </label>
            <div className="flex flex-wrap gap-2">
              {WOD_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                    type === t
                      ? 'bg-white text-black'
                      : 'border border-neutral-700 text-neutral-500 hover:border-neutral-500'
                  }`}
                >
                  {WOD_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
              Título
            </label>
            <input
              type="text"
              placeholder="Ej: Fran, Back Squat, Cindy..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
            />
          </div>

          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
              Descripción
            </label>
            <textarea
              placeholder={`Ej:\n21-15-9\nThrusters (42.5 kg)\nPull-ups`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={6}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none font-mono text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear WOD'}
          </button>
        </form>
    </>
  )

  if (inline) return <div className="w-full">{formContent}</div>

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg p-6">
        {formContent}
      </div>
    </div>
  )
}

// ── Ranking helpers ────────────────────────────────────

const PAGE_SIZE = 5

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

// ── Ranking Section ────────────────────────────────────

function RankingSection({ wod }: { wod: Wod }) {
  const [entries,  setEntries]  = useState<RankingEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    getWodRanking(wod.id)
      .then(data => { console.log('ranking data:', data); setEntries(sortRanking(data, wod.type)) })
      .catch(err => console.error('ranking error:', JSON.stringify(err)))
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

  const totalPages = Math.ceil(entries.length / PAGE_SIZE)
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="mt-10 border-t border-neutral-900 pt-8">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-5">
        Ranking · {entries.length} {entries.length === 1 ? 'atleta' : 'atletas'}
      </p>

      <div className="flex flex-col gap-3">
        {paged.map((entry, i) => {
          const pos      = page * PAGE_SIZE + i + 1
          const name     = entry.profiles?.full_name ?? 'Atleta'
          const score    = formatScore(entry, wod.type)
          const posLabel = pos === 1 ? '01' : pos === 2 ? '02' : pos === 3 ? '03' : `${pos.toString().padStart(2, '0')}`

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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-neutral-600 hover:text-white text-sm font-mono transition disabled:opacity-30"
          >
            ← anterior
          </button>
          <span className="text-neutral-700 text-xs font-mono">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="text-neutral-600 hover:text-white text-sm font-mono transition disabled:opacity-30"
          >
            siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Admin Page ─────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const programSlug  = searchParams.get('program') ?? 'bizarro'

  const today = useMemo(() => (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })(), [])

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(1)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingWod,    setEditingWod]    = useState<Wod | undefined>()
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [pendingBlock,  setPendingBlock]  = useState<number | null>(null)
  const [loadWeekOpen,  setLoadWeekOpen]  = useState(false)
  const [profileOpen,   setProfileOpen]   = useState(false)
  const [profileName,   setProfileName]   = useState('')
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [inviteUrl,     setInviteUrl]     = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [programName,   setProgramName]   = useState('')

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

    getMyPrograms(user.id).then(programs => {
      const found = programs.find(p => p.slug === programSlug)
      setProgramName(found?.name ?? programSlug)
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
    setSelectedBlock(wod.block)
    setModalOpen(false)
    setEditingWod(undefined)
  }

  async function handleDelete(id: string) {
    await deleteWod(id)
    setWods(prev => prev.filter(w => w.id !== id))
    setDeletingId(null)
  }

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string }[]) {
    for (const wod of parsed) {
      await createWod({ ...wod, program: programSlug as import('@/lib/types').Program })
    }
    const updated = await getWodsForWeek(weekDates[0], weekDates[6], programSlug as import('@/lib/types').Program)
    setWods(updated)
  }

  async function handleGenerateInvite() {
    if (!user) return
    setInviteLoading(true)
    try {
      const token = await createCoachInvite(user.id)
      const url = `${window.location.origin}/register?invite=${token}`
      setInviteUrl(url)
    } catch { } finally {
      setInviteLoading(false)
    }
  }

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  const dayWods   = wods.filter(w => w.date === selectedDate)
  const activeWod = dayWods.find(w => w.block === selectedBlock)

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

        {/* Header */}
        <header className="relative flex items-center justify-between px-6 py-5 border-b border-neutral-900">
          <div className="flex items-center gap-3">
            {(() => {
              const slugImages: Record<string, string> = { bizarro: '/logoBizarro.png', entrenemos: '/entrenemos.png' }
              const img = slugImages[programSlug]
              return img
                ? <Image src={img} alt={programName} width={48} height={48} className="object-contain" />
                : <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"><span className="text-white font-black text-sm uppercase">{programName[0]}</span></div>
            })()}
            <span className="text-white font-black text-xl tracking-tighter">{programName.toUpperCase()}</span>
          </div>

          {/* Centered tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 rounded-full p-1">
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-white"
            >
              Home
            </button>
            <button
              onClick={() => router.push(`/admin/atletas?program=${programSlug}`)}
              className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
            >
              Mis atletas
            </button>
          </div>

          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push('/select-program')}
              className="text-neutral-600 hover:text-white text-sm transition font-mono"
            >
              ← Programas
            </button>

          <div className="relative flex items-center">
            <button
              onClick={() => { setProfileOpen(v => !v); setInviteUrl(null) }}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              {avatarUrl
                ? <Image src={avatarUrl} alt="avatar" width={28} height={28} className="rounded-full object-cover" unoptimized />
                : (
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white text-xs font-black">{profileName[0]?.toUpperCase()}</span>
                  </div>
                )}
              <span className="text-white text-sm font-mono">{profileName.split(' ')[0]}</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[220px]">
                {inviteUrl ? (
                  <div className="px-4 py-3 border-b border-neutral-900">
                    <p className="text-neutral-500 text-xs font-mono mb-2">Copia el enlace:</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={inviteUrl}
                        className="flex-1 bg-neutral-900 text-white text-xs font-mono px-2 py-1.5 rounded-lg border border-neutral-700 min-w-0"
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(inviteUrl) }}
                        className="text-xs font-mono text-neutral-400 hover:text-white transition px-2 border border-neutral-700 rounded-lg"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateInvite}
                    disabled={inviteLoading}
                    className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition border-b border-neutral-900 disabled:opacity-40"
                  >
                    {inviteLoading ? 'Generando...' : 'Generar invitación'}
                  </button>
                )}

                <button
                  onClick={async () => { setProfileOpen(false); await handleLogout() }}
                  className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
                >
                  Salir
                </button>
              </div>
            )}
          </div>
          </div>
        </header>

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
                  onClick={() => { setSelectedDate(date); setSelectedBlock(1); setPendingBlock(null) }}
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

          {isSunday(selectedDate) ? (
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-4">Domingo</p>
              <h2 className="text-neutral-800 font-black text-6xl sm:text-7xl uppercase tracking-tighter leading-none">
                Descanso
              </h2>
            </div>
          ) : (<>

          {/* Block tabs — solo bloques con contenido + tab pendiente + botón añadir */}
          <div className="flex gap-2 mb-8 flex-wrap">
            {dayWods.map((wod) => (
              <button
                key={wod.block}
                onClick={() => { setSelectedBlock(wod.block); setPendingBlock(null) }}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  selectedBlock === wod.block && pendingBlock === null
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
                const nextBlock = dayWods.length > 0 ? Math.max(...dayWods.map(w => w.block)) + 1 : 1
                setPendingBlock(nextBlock)
                setSelectedBlock(nextBlock)
              }}
              className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition border border-dashed border-neutral-700 text-neutral-600 hover:border-neutral-500 hover:text-neutral-400"
            >
              + Bloque
            </button>
          </div>

          {/* Block content */}
          {activeWod ? (
            <div className="flex flex-col gap-6">
              {/* Type badge */}
              <div className="inline-flex border border-neutral-800 rounded-full px-4 py-1 w-fit">
                <span className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
                  {WOD_TYPE_LABEL[activeWod.type] ?? activeWod.type}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-white font-black text-5xl sm:text-6xl leading-none tracking-tighter uppercase">
                {activeWod.title}
              </h1>

              {/* Description */}
              <pre className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-mono border-l-2 border-neutral-800 pl-5">
                {activeWod.description}
              </pre>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
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
                      className="flex-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-neutral-500 transition text-sm"
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
            </div>
          ) : (dayWods.length === 0 || pendingBlock !== null) ? (
            <WodModal
              inline
              date={selectedDate}
              block={pendingBlock ?? 1}
              program={programSlug}
              onClose={() => {}}
              onSaved={handleSaved}
            />
          ) : null}
          </>)}
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
          onConfirm={handleLoadWeek}
          onClose={() => setLoadWeekOpen(false)}
        />
      )}
    </>
  )
}
