'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import TimerModal from '@/components/Timer'
import LoadWeekModal from '@/components/LoadWeekModal'
import {
  getProfile, getWodsForWeekLibre, createLibreWod, updateWod, deleteWod,
  getResultsForWods, upsertResult, maybeUpdatePR,
} from '@/lib/db'
import type { Wod, Result, WodType, NewWod } from '@/lib/types'

// ── Constants ───────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────

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

// ── WOD Form ────────────────────────────────────────────

function WodForm({ date, block, wod, onSaved, onCancel }: {
  date:     string
  block:    number
  wod?:     Wod
  onSaved:  (wod: Wod) => void
  onCancel?: () => void
}) {
  const { user } = useAuth()
  const [title,       setTitle]       = useState(wod?.title       ?? '')
  const [type,        setType]        = useState<WodType>(wod?.type ?? 'For Time')
  const [description, setDescription] = useState(wod?.description ?? '')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const isEdit = !!wod

  const dayFormatted = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es obligatorio'); return }
    if (!user) return
    setError('')
    setLoading(true)
    try {
      const saved = isEdit
        ? await updateWod(wod.id, { title, type, description })
        : await createLibreWod({ date, block, title, type, description } as Omit<NewWod, 'program'>, user.id)
      onSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
            {dayFormatted} · Bloque {block}
          </p>
          <h2 className="text-white font-black text-xl tracking-tight uppercase">
            {isEdit ? 'Editar WOD' : 'Nuevo WOD'}
          </h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">
            &times;
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Tipo</label>
          <div className="flex flex-wrap gap-2">
            {WOD_TYPES.map(t => (
              <button
                key={t} type="button" onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                  type === t ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-500 hover:border-neutral-500'
                }`}
              >
                {WOD_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Título</label>
          <input
            type="text" placeholder="Ej: Fran, Back Squat..." value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
          />
        </div>

        <div>
          <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Descripción</label>
          <textarea
            placeholder={`Ej:\n21-15-9\nThrusters (42.5 kg)\nPull-ups`} value={description}
            onChange={e => setDescription(e.target.value)} rows={6}
            className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none font-mono text-sm"
          />
        </div>

        {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear WOD'}
        </button>
      </form>
    </div>
  )
}

// ── Result Modal ─────────────────────────────────────────

function ResultModal({ wod, existing, onClose, onSaved }: {
  wod:       Wod
  existing?: Result
  onClose:   () => void
  onSaved:   (result: Result, isNewPR: boolean) => void
}) {
  const [scoreTime,   setScoreTime]   = useState(existing?.score_time ?? '')
  const [scoreRounds, setScoreRounds] = useState(existing?.score_rounds ?? '')
  const [scoreWeight, setScoreWeight] = useState(existing?.score_weight?.toString() ?? '')
  const [notes,       setNotes]       = useState(existing?.score_notes ?? '')
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
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">{WOD_TYPE_LABEL[wod.type]}</p>
            <h2 className="text-white font-black text-xl tracking-tight uppercase">{wod.title}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {wod.type === 'For Time' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Tiempo (mm:ss)</label>
              <input type="text" placeholder="14:32" value={scoreTime} onChange={e => setScoreTime(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition" />
            </div>
          )}
          {(wod.type === 'AMRAP' || wod.type === 'EMOM') && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Rondas + reps</label>
              <input type="text" placeholder="7+15" value={scoreRounds} onChange={e => setScoreRounds(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition" />
            </div>
          )}
          {wod.type === 'For Max' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Reps / Calorías</label>
              <input type="text" placeholder="47 cals / 32 reps" value={scoreRounds} onChange={e => setScoreRounds(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition" />
            </div>
          )}
          {wod.type === 'Strength' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Peso (kg)</label>
              <input type="number" step="0.5" placeholder="102.5" value={scoreWeight} onChange={e => setScoreWeight(e.target.value)}
                className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition" />
            </div>
          )}
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Notas (opcional)</label>
            <textarea placeholder="Escalas usadas, sensaciones..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none" />
          </div>
          <button type="button" onClick={() => setRx(!rx)} className="flex items-center gap-3 w-fit">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${rx ? 'bg-white border-white' : 'border-neutral-600'}`}>
              {rx && <span className="text-black text-xs font-black">✓</span>}
            </div>
            <span className="text-white text-sm font-medium">RX</span>
            <span className="text-neutral-500 text-xs font-mono">sin escalar</span>
          </button>
          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all mt-2">
            {loading ? 'Guardando...' : existing ? 'Actualizar resultado' : 'Guardar resultado'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Libre Page ───────────────────────────────────────────

export default function LibrePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const today = useMemo(() => (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })(), [])

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
  const [profileOpen,    setProfileOpen]    = useState(false)
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null)
  const [profileName,    setProfileName]    = useState('')
  const [generatingTimer, setGeneratingTimer] = useState(false)
  const [timerError,     setTimerError]     = useState(false)
  const [timerOpen,      setTimerOpen]      = useState(false)
  const [loadWeekOpen,   setLoadWeekOpen]   = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }

    getProfile(user.id).then(profile => {
      if (profile?.program !== 'libre') { router.push('/dashboard'); return }
      setProfileName(profile.full_name ?? '')
      setAvatarUrl(profile.avatar_url ?? null)
      setLoading(false)
    })
  }, [authLoading, user, router])

  useEffect(() => {
    if (loading || !user) return
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

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: import('@/lib/types').WodType; description: string }[]) {
    if (!user) return
    for (const wod of parsed) {
      await createLibreWod(wod, user.id)
    }
    const updated = await getWodsForWeekLibre(user.id, weekDates[0], weekDates[6])
    setWods(updated)
  }

  async function handleGenerateTimer(wod: { title: string; description: string; type: string }) {
    setGeneratingTimer(true)
    setTimerError(false)
    try {
      const res = await fetch('/api/generate-timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            <Image src="/logoBizarro.png" alt="Bizarro" width={32} height={32} className="object-contain" />
            <span className="text-white font-black text-xl tracking-tighter">BIZARRO</span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900 rounded-full p-1">
            <button
              onClick={() => router.push('/libre')}
              className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-white bg-neutral-800 rounded-full"
            >
              Home
            </button>
            <button
              onClick={() => setTimerOpen(v => !v)}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition ${timerOpen ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              Timer
            </button>
            <button
              onClick={() => router.push('/maximos')}
              className="px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-mono transition text-neutral-500 hover:text-neutral-300"
            >
              Mis PRs
            </button>
          </div>

          <div className="relative flex items-center">
            <button onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 hover:opacity-80 transition">
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
              <div className="absolute right-0 top-[calc(100%+12px)] bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
                <button
                  onClick={() => { setProfileOpen(false); router.push('/profile') }}
                  className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition border-b border-neutral-900"
                >
                  Editar perfil
                </button>
                <button
                  onClick={async () => { setProfileOpen(false); await signOut(); router.push('/login') }}
                  className="w-full px-4 py-2.5 text-left font-mono uppercase tracking-widest text-xs text-neutral-500 hover:text-white hover:bg-neutral-900 transition"
                >
                  Salir
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Banner nuevo PR */}
        {newPR && (
          <div className="bg-white text-black px-6 py-3 flex items-center justify-center gap-3">
            <span className="font-black uppercase tracking-widest text-sm">NUEVO PR</span>
            <span className="font-mono text-sm">{newPR}</span>
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-900">
          <button onClick={() => setWeekOffset(o => o - 1)} className="text-neutral-600 hover:text-white transition font-mono text-sm">
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
                  className={`flex flex-col items-center gap-1 px-5 py-4 border-b-2 transition-colors ${isSelected ? 'border-white' : 'border-transparent'}`}
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
              <div className="flex flex-col gap-6">
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
                      className="w-full border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white font-mono uppercase tracking-widest text-xs rounded-xl px-4 py-3 transition disabled:opacity-40"
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
                      <button onClick={() => setModalWod(activeWod)} className="text-neutral-600 hover:text-white text-sm font-mono transition">
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

      {timerOpen && <TimerModal onClose={() => setTimerOpen(false)} />}

      {loadWeekOpen && (
        <LoadWeekModal
          weekDates={weekDates}
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
