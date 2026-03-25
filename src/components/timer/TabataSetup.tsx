'use client'

import { useState } from 'react'
import { fmt } from './timer-utils'
import { ClockFace, Connector } from './ClockFace'
import type { TimerConfig } from '@/lib/types'

export default function TabataSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [work, setWork] = useState(20)
  const [rest, setRest] = useState(10)
  const [rounds, setRounds] = useState(8)
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">Tabata</p>
      <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-80">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">High intensity intervals</p>
        <div className="flex items-end justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Trabajo</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={60}
                value={work}
                onFocus={e => e.target.select()}
                onChange={e => setWork(Math.max(1, Math.min(60, Number(e.target.value))))}
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
                type="number"
                min={0}
                max={60}
                value={rest}
                onFocus={e => e.target.select()}
                onChange={e => setRest(Math.max(0, Math.min(60, Number(e.target.value))))}
                className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
              />
              <p className="text-neutral-600 text-xs font-mono">seg</p>
            </div>
          </div>
          <div className="w-px h-10 bg-neutral-600" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
            <input
              type="number"
              min={1}
              max={30}
              value={rounds}
              onFocus={e => e.target.select()}
              onChange={e => setRounds(Math.max(1, Math.min(30, Number(e.target.value))))}
              className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums"
            />
          </div>
        </div>
      </div>
      <Connector />
      <ClockFace display={fmt((work + rest) * rounds)} label="Total" onStart={() => onStart({ type: 'tabata', workSeconds: work, restSeconds: rest, rounds })} />
    </div>
  )
}
