'use client'

import { useState } from 'react'
import { fmt } from './timer-utils'
import { ClockFace, Connector } from './ClockFace'
import { useIsLandscape } from './LandscapeDisplay'
import type { TimerConfig } from '@/lib/types'

export default function ForTimeSetup({ onStart, initialConfig }: { onStart: (c: TimerConfig) => void; initialConfig?: { capSeconds: number } }) {
  const [hasCap, setHasCap] = useState(initialConfig ? initialConfig.capSeconds > 0 : false)
  const [capMinutes, setCapMinutes] = useState(initialConfig && initialConfig.capSeconds > 0 ? Math.round(initialConfig.capSeconds / 60) : 20)
  const isLandscape = useIsLandscape()

  const card = (
    <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-72">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Complete the workout as fast as possible</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setHasCap(v => !v)} className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${hasCap ? 'bg-white border-white' : 'border-neutral-600'}`}>
            {hasCap && <span className="text-black text-xs font-black">✓</span>}
          </div>
          <span className="text-neutral-400 text-sm font-mono">Time cap</span>
        </button>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={String(capMinutes)}
          disabled={!hasCap}
          onFocus={e => e.target.select()}
          onChange={e => { const v = e.target.value.replace(/\D/g, ''); setCapMinutes(v === '' ? 0 : Math.min(60, Number(v))) }}
          className={`w-16 bg-neutral-900 font-black text-xl text-center border rounded-lg px-3 py-2 focus:outline-none tabular-nums transition ${hasCap ? 'text-white border-neutral-700 focus:border-white' : 'text-neutral-700 border-neutral-800 cursor-not-allowed'}`}
        />
        <p className={`text-sm font-mono transition ${hasCap ? 'text-neutral-400' : 'text-neutral-700'}`}>min</p>
      </div>
    </div>
  )

  const clock = (
    <ClockFace
      compact={isLandscape}
      display={hasCap ? fmt(capMinutes * 60) : '00:00'}
      label={hasCap ? 'Time cap' : 'Sin límite'}
      disabled={hasCap && capMinutes === 0}
      onStart={() => onStart({ type: 'fortime', capSeconds: hasCap ? capMinutes * 60 : 0 })}
    />
  )

  if (isLandscape) {
    return (
      <div className="flex flex-row items-center justify-center gap-8 w-full">
        <div className="flex flex-col items-center gap-4">
          <p className="text-white font-black text-5xl uppercase tracking-tighter">For Time</p>
          {card}
        </div>
        {clock}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">For Time</p>
      {card}
      <Connector />
      {clock}
    </div>
  )
}
