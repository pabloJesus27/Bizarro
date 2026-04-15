'use client'

import { useState } from 'react'
import { fmt } from './timer-utils'
import { ClockFace, Connector } from './ClockFace'
import type { TimerConfig } from '@/lib/types'

export default function AMRAPSetup({ onStart, initialConfig }: { onStart: (c: TimerConfig) => void; initialConfig?: { totalSeconds: number } }) {
  const [minutes, setMinutes] = useState(initialConfig ? Math.round(initialConfig.totalSeconds / 60) : 20)

  const card = (
    <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-72">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">As Many Rounds As Possible</p>
      <div className="flex items-center justify-center gap-3">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={String(minutes)}
          onFocus={e => e.target.select()}
          onChange={e => { const v = e.target.value.replace(/\D/g, ''); setMinutes(v === '' ? 0 : Math.min(60, Number(v))) }}
          className="w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums"
        />
        <p className="text-neutral-400 text-sm font-mono">minutos</p>
      </div>
    </div>
  )

  const clock = <ClockFace display={fmt(minutes * 60)} label="Duración" disabled={minutes === 0} onStart={() => onStart({ type: 'amrap', totalSeconds: minutes * 60 })} />

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8 w-full">
      <div className="flex flex-col items-center gap-4">
        <p className="text-white font-black text-5xl uppercase tracking-tighter">AMRAP</p>
        {card}
      </div>
      <div className="sm:hidden"><Connector /></div>
      {clock}
    </div>
  )
}
