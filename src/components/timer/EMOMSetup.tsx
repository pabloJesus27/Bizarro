'use client'

import { useState } from 'react'
import { fmt } from './timer-utils'
import { ClockFace, Connector } from './ClockFace'
import type { TimerConfig } from '@/lib/types'

export default function EMOMSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [intMin, setIntMin] = useState(1)
  const [intSec, setIntSec] = useState(0)
  const [rounds, setRounds] = useState(10)
  const intervalSeconds = intMin * 60 + intSec
  const totalSeconds = intervalSeconds * rounds
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">EMOM</p>
      <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-72">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Every Minute On the Minute</p>
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Intervalo</p>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={String(intMin)}
                onFocus={e => e.target.select()}
                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setIntMin(v === '' ? 0 : Math.min(59, Number(v))) }}
                className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
              />
              <p className="text-neutral-600 text-xs font-mono">min</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={String(intSec)}
                onFocus={e => e.target.select()}
                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setIntSec(v === '' ? 0 : Math.min(59, Number(v))) }}
                className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
              />
              <p className="text-neutral-600 text-xs font-mono">seg</p>
            </div>
          </div>
          <div className="w-px h-10 bg-neutral-800" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
            <input
              type="number"
              min={1}
              max={99}
              value={rounds}
              onFocus={e => e.target.select()}
              onChange={e => setRounds(Math.max(1, Math.min(99, Number(e.target.value))))}
              className="w-14 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-2 py-2 focus:outline-none focus:border-white tabular-nums"
            />
          </div>
        </div>
        <div className="border-t border-neutral-800 pt-4 flex items-center justify-center gap-2">
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Total</p>
          <p className="text-neutral-300 font-black text-lg tabular-nums tracking-tighter">{fmt(totalSeconds)}</p>
        </div>
      </div>
      <Connector />
      <ClockFace display={fmt(totalSeconds)} label="Duración" onStart={() => onStart({ type: 'emom', totalSeconds, intervalSeconds })} />
    </div>
  )
}
