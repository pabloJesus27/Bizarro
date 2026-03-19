'use client'

import { useState } from 'react'
import { upsertResult, maybeUpdatePR } from '@/lib/db'
import type { Wod, Result } from '@/lib/types'

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

export default function ResultModal({ wod, existing, onClose, onSaved }: {
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
