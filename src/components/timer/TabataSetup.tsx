'use client'

import { useState } from 'react'
import { fmt } from './timer-utils'
import { ClockFace, Connector } from './ClockFace'
import { useIsLandscape } from './LandscapeDisplay'
import type { TimerConfig } from '@/lib/types'

export default function TabataSetup({ onStart, initialConfig }: { onStart: (c: TimerConfig) => void; initialConfig?: { workSeconds: number; restSeconds: number; rounds: number } }) {
  const [work, setWork] = useState(initialConfig ? initialConfig.workSeconds : 20)
  const [rest, setRest] = useState(initialConfig ? initialConfig.restSeconds : 10)
  const [rounds, setRounds] = useState(initialConfig ? initialConfig.rounds : 8)
  const isDisabled = work === 0 || rounds === 0
  const isLandscape = useIsLandscape()

  const card = (
    <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-80">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">High intensity intervals</p>
      <div className="flex items-end justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Trabajo</p>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={String(work)}
              onFocus={e => e.target.select()}
              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setWork(v === '' ? 0 : Math.min(60, Number(v))) }}
              className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
            />
            <p className="text-neutral-600 text-xs font-mono">seg</p>
          </div>
        </div>
        <div className="w-px h-10 bg-neutral-600" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Descanso</p>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={String(rest)}
              onFocus={e => e.target.select()}
              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setRest(v === '' ? 0 : Math.min(60, Number(v))) }}
              className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
            />
            <p className="text-neutral-600 text-xs font-mono">seg</p>
          </div>
        </div>
        <div className="w-px h-10 bg-neutral-600" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={String(rounds)}
            onFocus={e => e.target.select()}
            onChange={e => { const v = e.target.value.replace(/\D/g, ''); setRounds(v === '' ? 0 : Math.min(30, Number(v))) }}
            className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
          />
        </div>
      </div>
    </div>
  )

  const clock = <ClockFace compact={isLandscape} display={fmt((work + rest) * rounds)} label="Total" disabled={isDisabled} onStart={() => onStart({ type: 'tabata', workSeconds: work, restSeconds: rest, rounds })} />

  if (isLandscape) {
    return (
      <div className="flex flex-row items-center justify-center gap-8 w-full">
        <div className="flex flex-col items-center gap-4">
          <p className="text-white font-black text-5xl uppercase tracking-tighter">Tabata</p>
          {card}
        </div>
        {clock}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">Tabata</p>
      {card}
      <Connector />
      {clock}
    </div>
  )
}
