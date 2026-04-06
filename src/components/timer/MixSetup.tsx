'use client'

import { useRef, useState } from 'react'
import { fmt } from './timer-utils'
import type { TimerConfig, MixBlock } from '@/lib/types'

type MixBlockWithId = MixBlock & { id: number }

export default function MixSetup({ onStart, initialBlocks }: { onStart: (c: TimerConfig) => void; initialBlocks?: MixBlock[] }) {
  const idCounter = useRef(0)
  const [blocks, setBlocks] = useState<MixBlockWithId[]>(() =>
    (initialBlocks ?? []).map(b => ({ ...b, id: ++idCounter.current }))
  )
  const [newLabel, setNewLabel] = useState('')
  const [newMinutes, setNewMinutes] = useState(1)
  const [newSecs, setNewSecs] = useState(0)
  const [showSubTypes, setShowSubTypes] = useState(false)
  const [forTimeCap, setForTimeCap] = useState(false)
  const [emomIntMin, setEmomIntMin] = useState(1)
  const [emomIntSec, setEmomIntSec] = useState(0)
  const [emomRounds, setEmomRounds] = useState(10)
  const emomTotal = (emomIntMin * 60 + emomIntSec) * emomRounds
  const [tabWork, setTabWork] = useState(20)
  const [tabRest, setTabRest] = useState(10)
  const [tabRounds, setTabRounds] = useState(8)
  const tabTotal = (tabWork + tabRest) * tabRounds
  const [cardOpen, setCardOpen] = useState(true)
  const dragIdx = useRef<number | null>(null)
  const touchDrag = useRef<{ from: number; over: number } | null>(null)
  const [touchVisual, setTouchVisual] = useState<{ from: number; over: number } | null>(null)

  function addBlock() {
    if (!newLabel.trim()) return
    let block: MixBlockWithId
    if (newLabel === 'EMOM') {
      const intSecs = emomIntMin * 60 + emomIntSec
      block = { id: ++idCounter.current, label: 'EMOM', seconds: emomTotal, intervalSeconds: intSecs }
    } else if (newLabel === 'Tabata') {
      block = { id: ++idCounter.current, label: 'Tabata', seconds: tabTotal, tabataWork: tabWork, tabataRest: tabRest }
    } else {
      const seconds = newMinutes * 60 + newSecs
      const countUp = newLabel === 'For Time' ? true : undefined
      block = { id: ++idCounter.current, label: newLabel.trim(), seconds, ...(countUp ? { countUp } : {}) }
    }
    setBlocks(prev => {
      if (prev.length === 0) setCardOpen(false)
      return [...prev, block]
    })
    setNewLabel('')
    setNewMinutes(1)
    setNewSecs(0)
    setShowSubTypes(false)
  }

  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i))
  }

  const total = blocks.reduce((acc, b) => acc + b.seconds, 0)

  const isAddDisabled = showSubTypes
    ? (newLabel === 'AMRAP' && newMinutes === 0) ||
      (newLabel === 'For Time' && forTimeCap && newMinutes === 0) ||
      (newLabel === 'EMOM' && emomTotal === 0) ||
      (newLabel === 'Tabata' && tabTotal === 0)
    : newLabel !== '' && newMinutes === 0 && newSecs === 0

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">Mix</p>

      {/* Tarjeta de configuración */}
      <div className="border border-neutral-700 rounded-2xl px-6 py-5 flex flex-col gap-5 w-80">
        <button
          onClick={() => setCardOpen(o => !o)}
          className="flex items-center justify-between w-full"
        >
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Bloques personalizados</p>
          <span className={`text-neutral-500 text-xs font-mono transition-transform duration-200 ${cardOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {cardOpen && (
          <>
            <div className="flex gap-2">
              {[['Nuevo entr.', 'Nuevo entr.'], ['Trabajo', 'Trabajo'], ['Descanso', 'Descanso']].map(([display, value]) => (
                <button
                  key={value}
                  onClick={() => {
                    if (value === 'Nuevo entr.') {
                      setShowSubTypes(true)
                      setNewLabel('')
                    } else {
                      setShowSubTypes(false)
                      setNewLabel(value)
                      setNewMinutes(1)
                      setNewSecs(0)
                    }
                  }}
                  className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-mono text-center leading-tight uppercase tracking-wide whitespace-nowrap transition border ${(value === 'Nuevo entr.' ? showSubTypes : newLabel === value) ? 'border-white text-white' : 'border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500'}`}
                >
                  {display}
                </button>
              ))}
            </div>

            {showSubTypes && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {['AMRAP', 'For Time', 'EMOM', 'Tabata'].map(sub => (
                    <button
                      key={sub}
                      onClick={() => { setNewLabel(sub); setNewMinutes(sub === 'AMRAP' ? 20 : 5) }}
                      className={`px-1 py-2 rounded-lg text-[10px] font-mono text-center uppercase tracking-wide transition border ${newLabel === sub ? 'border-white text-white' : 'border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500'}`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {newLabel === 'AMRAP' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">As Many Rounds As Possible</p>
                    <div className="flex items-center justify-center gap-3">
                      <input type="text" inputMode="numeric" maxLength={2} value={String(newMinutes)} onFocus={e => e.target.select()}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setNewMinutes(v === '' ? 0 : Math.min(60, Number(v))) }}
                        className="w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums" />
                      <p className="text-neutral-400 text-sm font-mono">minutos</p>
                    </div>
                  </div>
                )}

                {newLabel === 'For Time' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Complete the workout as fast as possible</p>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => setForTimeCap(v => !v)} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${forTimeCap ? 'bg-white border-white' : 'border-neutral-600'}`}>
                          {forTimeCap && <span className="text-black text-xs font-black">✓</span>}
                        </div>
                        <span className="text-neutral-400 text-sm font-mono">Time cap</span>
                      </button>
                      <input type="text" inputMode="numeric" maxLength={2} value={String(newMinutes)} onFocus={e => e.target.select()}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setNewMinutes(v === '' ? 0 : Math.min(60, Number(v))) }}
                        disabled={!forTimeCap}
                        className={`w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums transition ${!forTimeCap ? 'opacity-30 cursor-not-allowed' : ''}`} />
                      <p className={`text-neutral-400 text-sm font-mono transition ${!forTimeCap ? 'opacity-30' : ''}`}>min</p>
                    </div>
                  </div>
                )}

                {newLabel === 'EMOM' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Every Minute On the Minute</p>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Intervalo</p>
                        <div className="flex items-center gap-1">
                          <input type="text" inputMode="numeric" maxLength={2} value={String(emomIntMin)}
                            onFocus={e => e.target.select()}
                            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setEmomIntMin(v === '' ? 0 : Math.min(59, Number(v))) }}
                            className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                          <p className="text-neutral-600 text-xs font-mono">min</p>
                          <input type="text" inputMode="numeric" maxLength={2} value={String(emomIntSec)}
                            onFocus={e => e.target.select()}
                            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setEmomIntSec(v === '' ? 0 : Math.min(59, Number(v))) }}
                            className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                          <p className="text-neutral-600 text-xs font-mono">seg</p>
                        </div>
                      </div>
                      <div className="w-px h-10 bg-neutral-800" />
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
                        <input type="text" inputMode="numeric" maxLength={2} value={String(emomRounds)} onFocus={e => e.target.select()}
                          onChange={e => { const v = e.target.value.replace(/\D/g, ''); setEmomRounds(v === '' ? 0 : Math.min(99, Number(v))) }}
                          className="w-14 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-2 py-2 focus:outline-none focus:border-white tabular-nums" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Total</p>
                      <p className="text-neutral-300 font-black text-lg tabular-nums tracking-tighter">{fmt(emomTotal)}</p>
                    </div>
                  </div>
                )}

                {newLabel === 'Tabata' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">High intensity intervals</p>
                    <div className="flex items-end justify-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Trabajo</p>
                        <div className="flex items-center gap-1">
                          <input type="text" inputMode="numeric" maxLength={2} value={String(tabWork)} onFocus={e => e.target.select()}
                            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setTabWork(v === '' ? 0 : Math.min(60, Number(v))) }}
                            className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                          <p className="text-neutral-600 text-xs font-mono">seg</p>
                        </div>
                      </div>
                      <div className="w-px h-10 bg-neutral-800" />
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Descanso</p>
                        <div className="flex items-center gap-1">
                          <input type="text" inputMode="numeric" maxLength={2} value={String(tabRest)} onFocus={e => e.target.select()}
                            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setTabRest(v === '' ? 0 : Math.min(60, Number(v))) }}
                            className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                          <p className="text-neutral-600 text-xs font-mono">seg</p>
                        </div>
                      </div>
                      <div className="w-px h-10 bg-neutral-800" />
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
                        <input type="text" inputMode="numeric" maxLength={2} value={String(tabRounds)} onFocus={e => e.target.select()}
                          onChange={e => { const v = e.target.value.replace(/\D/g, ''); setTabRounds(v === '' ? 0 : Math.min(30, Number(v))) }}
                          className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Total</p>
                      <p className="text-neutral-300 font-black text-lg tabular-nums tracking-tighter">{fmt(tabTotal)}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!showSubTypes && !newLabel && (
              <p className="text-neutral-600 text-xs font-mono text-center leading-relaxed">
                Combina bloques de entrenamiento, descanso y diferentes tipos de timer en un solo workout personalizado.
              </p>
            )}

            {!showSubTypes && newLabel && (
              <div className="flex items-center justify-center gap-2">
                <p className="text-neutral-400 text-sm font-mono uppercase tracking-widest">Tiempo :</p>
                <input type="text" inputMode="numeric" maxLength={2} value={String(newMinutes)} onFocus={e => e.target.select()}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); setNewMinutes(v === '' ? 0 : Math.min(59, Number(v))) }}
                  onBlur={() => { if (newMinutes === 0 && newSecs === 0) setNewSecs(30) }}
                  className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                <p className="text-neutral-600 text-xs font-mono">min</p>
                <input type="text" inputMode="numeric" maxLength={2} value={String(newSecs)} onFocus={e => e.target.select()}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); setNewSecs(v === '' ? 0 : Math.min(59, Number(v))) }}
                  className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                <p className="text-neutral-600 text-xs font-mono">seg</p>
              </div>
            )}

            <button
              onClick={addBlock}
              disabled={isAddDisabled}
              className="w-full border border-neutral-700 text-white font-mono uppercase tracking-widest text-xs py-2 rounded-lg hover:border-white transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              + Añadir
            </button>
          </>
        )}
      </div>

      {/* Lista de bloques */}
      {blocks.length > 0 && (
        <div className="flex flex-col gap-2 w-80">
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Resumen</p>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-track]:bg-neutral-900 [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
            {blocks.map((b, i) => (
              <div
                key={b.id}
                data-idx={i}
                draggable
                onDragStart={() => { dragIdx.current = i }}
                onDragOver={e => { e.preventDefault() }}
                onDrop={() => {
                  const from = dragIdx.current
                  if (from === null || from === i) return
                  setBlocks(prev => {
                    const next = [...prev]
                    const [moved] = next.splice(from, 1)
                    next.splice(i, 0, moved)
                    return next
                  })
                  dragIdx.current = null
                }}
                className={`flex items-center justify-between border rounded-xl px-3 py-2 transition ${touchVisual?.from === i ? 'opacity-40 border-neutral-800' : touchVisual?.over === i ? 'border-white' : 'border-neutral-800'}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    style={{ touchAction: 'none' }}
                    className="text-neutral-700 hover:text-white transition cursor-grab active:cursor-grabbing"
                    onTouchStart={() => { touchDrag.current = { from: i, over: i }; setTouchVisual({ from: i, over: i }) }}
                    onTouchMove={e => {
                      if (!touchDrag.current) return
                      const touch = e.touches[0]
                      const el = document.elementFromPoint(touch.clientX, touch.clientY)
                      const blockEl = el?.closest('[data-idx]')
                      if (blockEl) {
                        const over = Number(blockEl.getAttribute('data-idx'))
                        touchDrag.current.over = over
                        setTouchVisual({ from: touchDrag.current.from, over })
                      }
                    }}
                    onTouchEnd={() => {
                      if (!touchDrag.current) return
                      const { from, over } = touchDrag.current
                      touchDrag.current = null
                      setTouchVisual(null)
                      if (from === over) return
                      setBlocks(prev => {
                        const next = [...prev]
                        const [moved] = next.splice(from, 1)
                        next.splice(over, 0, moved)
                        return next
                      })
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <div>
                    <p className="text-white text-sm font-mono">{b.label}</p>
                    <p className="text-neutral-600 text-xs font-mono">{b.countUp && b.seconds === 0 ? 'Sin cap' : fmt(b.seconds)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setBlocks(prev => [...prev, { ...prev[i], id: ++idCounter.current }])} className="text-neutral-700 hover:text-white transition">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M3 11V3a1 1 0 0 1 1-1h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button onClick={() => removeBlock(i)} className="text-neutral-700 hover:text-white text-lg font-mono transition">×</button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-neutral-700 text-xs font-mono text-right">Total: {fmt(total)}</p>
        </div>
      )}

      <button
        onClick={() => blocks.length > 0 && onStart({ type: 'mix', blocks: blocks.map(({ id: _, ...b }) => b) })}
        disabled={blocks.length === 0}
        className="w-80 bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl text-sm disabled:opacity-30"
      >
        Listo
      </button>
      {/iPad|iPhone|iPod/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') && (
        <p className="text-neutral-600 text-xs font-mono text-center">⚠️ Desactiva el modo silencio para escuchar los beeps</p>
      )}
    </div>
  )
}
