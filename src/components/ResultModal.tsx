'use client'

import { useState } from 'react'
import { upsertResult, maybeUpdatePR } from '@/lib/db'
import type { Wod, Result } from '@/lib/types'
import { WOD_TYPE_LABEL, detectPRExercise } from '@/lib/wod-utils'
import { getTodayStr } from '@/lib/week-utils'
import HelpModal from './HelpModal'
import { useFirstVisit } from '@/hooks/useFirstVisit'

export default function ResultModal({ wod, existing, onClose, onSaved }: {
  wod:       Wod
  existing?: Result
  onClose:   () => void
  onSaved:   (result: Result, isNewPR: boolean) => void
}) {
  const [scoreTime,    setScoreTime]    = useState(existing?.score_time ?? '')
  const [scoreRounds,  setScoreRounds]  = useState(() => {
    const m = existing?.score_rounds?.match(/^(\d+)\+(\d+)$/)
    return m ? m[1] : (existing?.score_rounds ?? '')
  })
  const [scoreReps,    setScoreReps]    = useState(() => {
    const m = existing?.score_rounds?.match(/^(\d+)\+(\d+)$/)
    return m ? m[2] : ''
  })
  const [scoreWeight,  setScoreWeight]  = useState(existing?.score_weight?.toString() ?? '')
  const [notes,        setNotes]        = useState(existing?.score_notes ?? '')
  const [rx,           setRx]           = useState(existing?.rx ?? true)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [isDirty,      setIsDirty]      = useState(false)
  const { show: showHelp, dismiss: dismissHelp, open: openHelp } = useFirstVisit('resultado-prs')

  function markDirty() { if (!isDirty) setIsDirty(true) }

  const timeValid   = !scoreTime   || /^\d{1,2}:\d{2}$/.test(scoreTime.trim())
  const weightValid = !scoreWeight || (!isNaN(parseFloat(scoreWeight)) && parseFloat(scoreWeight) > 0 && parseFloat(scoreWeight) <= 500)

  function handleClose() {
    if (isDirty) { setConfirmClose(true) } else { onClose() }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (scoreWeight) {
      const w = parseFloat(scoreWeight)
      if (isNaN(w) || w <= 0 || w > 500) {
        setError('El peso debe estar entre 0 y 500 kg')
        return
      }
    }

    setLoading(true)
    try {
      const result = await upsertResult({
        wod_id:       wod.id,
        score_time:   scoreTime   || null,
        score_rounds: (wod.type === 'AMRAP' || wod.type === 'EMOM')
          ? (scoreRounds && scoreReps ? `${scoreRounds}+${scoreReps}` : scoreRounds || null)
          : (scoreRounds || null),
        score_weight: scoreWeight ? parseFloat(scoreWeight) : null,
        score_notes:  notes       || null,
        rx,
      })

      let isNewPR = false
      if (wod.type === 'Strength' && scoreWeight && result.user_id) {
        const exercise = detectPRExercise(wod.title)
        if (exercise) {
          const today = getTodayStr()
          const pr = await maybeUpdatePR(result.user_id, exercise, parseFloat(scoreWeight), today, wod.id)
          isNewPR = pr.isNewPR
        }
      }

      onSaved(result, isNewPR)
    } catch (err: unknown) {
      setError('No se pudo guardar el resultado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmClose) return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <p className="text-white font-black text-lg uppercase tracking-tight">¿Salir sin guardar?</p>
        <p className="text-neutral-400 text-sm font-mono">Perderás los datos introducidos.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-neutral-700 text-neutral-400 font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:border-red-800 hover:text-red-500 transition text-sm"
          >
            Salir
          </button>
          <button
            onClick={() => setConfirmClose(false)}
            className="flex-1 bg-white text-black font-bold uppercase tracking-widest rounded-xl px-4 py-3 hover:bg-neutral-200 transition text-sm"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-md p-6">

        {showHelp && <HelpModal helpKey="resultado-prs" onClose={dismissHelp} />}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">
              {WOD_TYPE_LABEL[wod.type] ?? wod.type}
            </p>
            <h2 className="text-white font-black text-xl tracking-tight uppercase">{wod.title}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={handleClose} className="text-neutral-500 hover:text-white text-2xl leading-none transition">
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {wod.type === 'For Time' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Tiempo (mm:ss)
              </label>
              <input
                type="text" placeholder="14:32" value={scoreTime}
                onChange={e => { setScoreTime(e.target.value); markDirty() }}
                className={`w-full bg-neutral-900 text-white placeholder-neutral-600 border rounded-lg px-4 py-3 focus:outline-none transition ${
                  !timeValid ? 'border-red-800 focus:border-red-500' : 'border-neutral-700 focus:border-white'
                }`}
              />
              {scoreTime && !timeValid && (
                <p className="text-red-500 text-xs font-mono mt-1">Formato inválido — usa mm:ss (ej: 14:32)</p>
              )}
              {scoreTime && timeValid && (
                <p className="text-green-600 text-xs font-mono mt-1">✓ Correcto</p>
              )}
            </div>
          )}
          {(wod.type === 'AMRAP' || wod.type === 'EMOM') && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                  Rondas
                </label>
                <input
                  type="number" min="0" placeholder="7" value={scoreRounds}
                  onChange={e => { setScoreRounds(e.target.value); markDirty() }}
                  className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
                />
              </div>
              <div className="flex-1">
                <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                  Reps extra
                </label>
                <input
                  type="number" min="0" placeholder="15" value={scoreReps}
                  onChange={e => { setScoreReps(e.target.value); markDirty() }}
                  className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition"
                />
              </div>
            </div>
          )}
          {wod.type === 'For Max' && (
            <div>
              <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
                Total
              </label>
              <input
                type="number" min="0" placeholder="47" value={scoreRounds}
                onChange={e => { setScoreRounds(e.target.value); markDirty() }}
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
                type="number" step="0.5" min="0" max="500" placeholder="102.5" value={scoreWeight}
                onChange={e => { setScoreWeight(e.target.value); markDirty() }}
                className={`w-full bg-neutral-900 text-white placeholder-neutral-600 border rounded-lg px-4 py-3 focus:outline-none transition ${
                  !weightValid ? 'border-red-800 focus:border-red-500' : 'border-neutral-700 focus:border-white'
                }`}
              />
              {scoreWeight && !weightValid && (
                <p className="text-red-500 text-xs font-mono mt-1">Debe ser entre 0 y 500 kg</p>
              )}
              {scoreWeight && weightValid && (
                <p className="text-green-600 text-xs font-mono mt-1">✓ Correcto</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-neutral-500 text-xs uppercase tracking-widest mb-1 font-mono">
              Notas (opcional)
            </label>
            <textarea
              placeholder="Escalas usadas, sensaciones..." value={notes}
              onChange={e => { setNotes(e.target.value); markDirty() }} rows={2}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-700 rounded-lg px-4 py-3 focus:outline-none focus:border-white transition resize-none"
            />
          </div>

          <button type="button" onClick={() => { setRx(!rx); markDirty() }} className="flex items-center gap-3 w-fit">
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
