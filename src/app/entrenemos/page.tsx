'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { signOut } from '@/lib/auth'
import { getWodsForWeek, createWod, updateWod, deleteWod } from '@/lib/db'
import type { Wod, WodType } from '@/lib/types'
import LoadWeekModal from '@/components/LoadWeekModal'
import { DAY_SHORT, isSunday, getWeekDates, formatWeekRange } from '@/lib/week-utils'
import { WOD_TYPE_LABEL } from '@/lib/wod-utils'

const WOD_TYPES: WodType[] = ['Warmup', 'Strength', 'For Time', 'AMRAP', 'EMOM', 'For Max', 'Other']

// ── WOD Modal ──────────────────────────────────────────

function WodModal({ date, block, wod, onClose, onSaved }: {
  date:    string
  block:   number
  wod?:    Wod
  onClose: () => void
  onSaved: (wod: Wod) => void
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
        : await createWod({ date, block, title, type, description, program: 'entrenemos' })
      onSaved(saved)
    } catch (err: unknown) {
      setError('No se pudo guardar el WOD. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const dayFormatted = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg p-6">

        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
              {dayFormatted} · Bloque {block}
            </p>
            <h2 className="text-white font-black text-xl tracking-tight uppercase">
              {isEdit ? 'Editar WOD' : 'Nuevo WOD'}
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition ml-4">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {WOD_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
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
              placeholder={`Ej:\n21-15-9\nThrusters\nPull-ups`} value={description}
              onChange={e => setDescription(e.target.value)} rows={5}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none font-mono text-sm"
            />
          </div>

          {error && <p className="text-red-400 text-sm font-mono">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-white text-black font-black uppercase tracking-widest rounded-xl px-4 py-4 hover:bg-neutral-200 disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear WOD'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Entrenemos Page ────────────────────────────────────

export default function EntrenemosPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const today     = useMemo(() => (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })(), [])
  const [weekOffset,    setWeekOffset]    = useState(0)
  const [selectedDate,  setSelectedDate]  = useState(today)
  const [selectedBlock, setSelectedBlock] = useState(1)
  const [wods,          setWods]          = useState<Wod[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalBlock,    setModalBlock]    = useState<number | null>(null)
  const [editingWod,    setEditingWod]    = useState<Wod | undefined>()
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [loadWeekOpen,  setLoadWeekOpen]  = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
  }, [authLoading, user, router])

  useEffect(() => {
    setLoading(true)
    getWodsForWeek(weekDates[0], weekDates[6], 'entrenemos')
      .then(setWods)
      .finally(() => setLoading(false))
  }, [weekDates])

  useEffect(() => {
    setSelectedDate(weekDates[0])
    setSelectedBlock(1)
  }, [weekOffset, weekDates])

  async function handleLoadWeek(parsed: { date: string; block: number; title: string; type: WodType; description: string }[]) {
    for (const wod of parsed) {
      await createWod({ ...wod, program: 'entrenemos' })
    }
    const updated = await getWodsForWeek(weekDates[0], weekDates[6], 'entrenemos')
    setWods(updated)
  }

  function handleSaved(wod: Wod) {
    setWods(prev => {
      const idx = prev.findIndex(w => w.id === wod.id)
      if (idx >= 0) { const u = [...prev]; u[idx] = wod; return u }
      return [...prev, wod]
    })
    setModalBlock(null)
    setEditingWod(undefined)
  }

  async function handleDelete(id: string) {
    await deleteWod(id)
    setWods(prev => prev.filter(w => w.id !== id))
    setDeletingId(null)
  }

  // Bloques visibles: mínimo 1 y 2, más los que existan
  const dayWods = wods.filter(w => w.date === selectedDate)
  const existingBlockNums = dayWods.map(w => w.block)
  const visibleBlocks = Array.from(new Set([1, 2, ...existingBlockNums])).sort((a, b) => a - b)
  const nextBlock = Math.max(...visibleBlocks) + 1
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
        <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-900">
          <div className="flex items-center gap-3">
            <Image src="/entrenemos.png" alt="Entrenemos" width={32} height={32} className="object-contain" />
            <span className="text-white font-black text-xl tracking-tighter">ENTRENEMOS</span>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => router.push('/select-program')} className="text-neutral-600 hover:text-white text-sm transition font-mono">
              ← Programas
            </button>
            <button onClick={async () => { await signOut(); router.push('/login') }} className="text-neutral-600 hover:text-white text-sm transition font-mono">
              Salir →
            </button>
          </div>
        </header>

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-900">
          <button onClick={() => setWeekOffset(o => o - 1)} className="text-neutral-600 hover:text-white transition font-mono text-sm">← anterior</button>
          <div className="flex flex-col items-center gap-1">
            <span className="text-neutral-400 text-sm font-mono uppercase tracking-widest">{formatWeekRange(weekDates)}</span>
            <button
              onClick={() => setLoadWeekOpen(true)}
              className="text-neutral-600 hover:text-white text-xs font-mono transition"
            >
              ↓ Cargar semana
            </button>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="text-neutral-600 hover:text-white transition font-mono text-sm">siguiente →</button>
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
                <button key={date} onClick={() => { setSelectedDate(date); setSelectedBlock(1) }}
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

            {/* Block tabs + añadir bloque */}
            <div className="flex gap-2 mb-8 flex-wrap items-center">
              {visibleBlocks.map((block) => {
                const wod      = dayWods.find(w => w.block === block)
                const isActive = selectedBlock === block
                const label    = wod ? (WOD_TYPE_LABEL[wod.type] ?? wod.type) : `Bloque ${block}`
                return (
                  <button key={block} onClick={() => setSelectedBlock(block)}
                    className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono transition ${
                      isActive ? 'bg-white text-black' : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
              <button
                onClick={() => { setSelectedBlock(nextBlock); setEditingWod(undefined); setModalBlock(nextBlock) }}
                className="px-4 py-2 rounded-full text-xs uppercase tracking-widest font-mono border border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400 transition"
              >
                + Bloque
              </button>
            </div>

            {/* Block content */}
            {activeWod ? (
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

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setEditingWod(activeWod); setModalBlock(activeWod.block) }}
                    className="flex-1 border border-neutral-700 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-white transition text-sm"
                  >
                    Editar
                  </button>
                  {deletingId === activeWod.id ? (
                    <div className="flex-1 flex gap-2">
                      <button onClick={() => handleDelete(activeWod.id)}
                        className="flex-1 bg-red-600 text-white font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:bg-red-500 transition text-sm"
                      >
                        Confirmar
                      </button>
                      <button onClick={() => setDeletingId(null)}
                        className="flex-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-widest rounded-xl px-4 py-3 transition text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(activeWod.id)}
                      className="flex-1 border border-neutral-800 text-neutral-600 font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-red-800 hover:text-red-500 transition text-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-6">
                <div>
                  <p className="text-neutral-700 text-xs uppercase tracking-widest font-mono mb-3">Bloque {selectedBlock} · Sin programar</p>
                  <h2 className="text-neutral-800 font-black text-5xl uppercase tracking-tighter leading-none">Vacío</h2>
                </div>
                <button
                  onClick={() => { setEditingWod(undefined); setModalBlock(selectedBlock) }}
                  className="border border-neutral-700 text-white font-black uppercase tracking-widest rounded-xl px-6 py-4 hover:border-white hover:bg-neutral-900 transition text-sm"
                >
                  + Añadir WOD
                </button>
              </div>
            )}
          </>)}
        </div>
      </main>

      {modalBlock !== null && (
        <WodModal
          date={selectedDate}
          block={modalBlock}
          wod={editingWod}
          onClose={() => { setModalBlock(null); setEditingWod(undefined) }}
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
