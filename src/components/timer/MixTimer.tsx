'use client'

import { useEffect, useRef, useState } from 'react'
import { fmt, beep } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'
import type { MixBlock } from '@/lib/types'

export default function MixTimer({ blocks }: { blocks: MixBlock[] }) {
  const [blockIdx, setBlockIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const current = blocks[blockIdx]
  const blockDuration = Math.max(1, current?.seconds ?? 1)
  const remaining = current ? blockDuration - elapsed : 0

  // Tick: solo incrementa elapsed cada segundo
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(id)
  }, [running, blockIdx])

  // Transición de bloque: cuando elapsed alcanza la duración
  useEffect(() => {
    if (!running || elapsed < blockDuration) return
    if (blockIdx + 1 >= blocks.length) {
      setRunning(false)
      setFinished(true)
      if (audioRef.current) beep(audioRef.current, 440, 1.5, 0.8)
    } else {
      setBlockIdx(i => i + 1)
      setElapsed(0)
      if (audioRef.current) {
        beep(audioRef.current, 880, 0.2, 0.8)
        setTimeout(() => beep(audioRef.current!, 1100, 0.5, 0.8), 350)
      }
    }
  }, [elapsed, running, blockIdx, blocks.length, blockDuration])

  // Aviso 30 segundos
  useEffect(() => {
    if (!running || !audioRef.current) return
    if (remaining === 30 && blockDuration > 30) {
      beep(audioRef.current, 660, 0.15, 0.5)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 0.5), 250)
    }
  }, [remaining, running, blockDuration])

  function handleStart() { audioRef.current = new AudioContext(); setInPreCountdown(true) }

  return (
    <>
      {inPreCountdown && audioRef.current && (
        <PreStartCountdown audioCtx={audioRef.current} onDone={() => { setInPreCountdown(false); setRunning(true) }} />
      )}
      {finished && (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
          <p className="text-white font-black text-7xl uppercase tracking-tighter">TIME!</p>
        </div>
      )}
      <div className="flex flex-col items-center min-h-[calc(100vh-160px)]">
        <p className="text-white font-black text-5xl uppercase tracking-tighter">{current?.label}</p>
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mt-1">
          Bloque {blockIdx + 1} / {blocks.length}
        </p>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-[28rem] h-[28rem]">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="none" stroke="#262626" strokeWidth="1.5" />
                {Array.from({ length: 60 }).map((_, i) => {
                  const angle = (i * 360) / 60
                  const rad = (angle - 90) * (Math.PI / 180)
                  const isMajor = i % 5 === 0
                  const r1 = isMajor ? 80 : 85
                  const r2 = 93
                  const cos = Math.cos(rad)
                  const sin = Math.sin(rad)
                  return (
                    <line
                      key={i}
                      x1={parseFloat((100 + r1 * cos).toFixed(4))}
                      y1={parseFloat((100 + r1 * sin).toFixed(4))}
                      x2={parseFloat((100 + r2 * cos).toFixed(4))}
                      y2={parseFloat((100 + r2 * sin).toFixed(4))}
                      stroke={isMajor ? '#525252' : '#303030'}
                      strokeWidth={isMajor ? 2 : 1}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Restante</p>
                <p className="text-white font-black text-6xl tabular-nums tracking-tighter leading-none">{fmt(remaining)}</p>
                {!running && !finished && !inPreCountdown && (
                  <button onClick={handleStart} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                    {blockIdx === 0 && elapsed === 0 ? 'Iniciar' : 'Reanudar'}
                  </button>
                )}
                {running && (
                  <button onClick={() => setRunning(false)} className="mt-1 border border-neutral-700 text-white font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                    Pausar
                  </button>
                )}
              </div>
            </div>
            {blockIdx + 1 < blocks.length && (
              <p className="text-neutral-600 text-xs font-mono">
                Siguiente: {blocks[blockIdx + 1].label} · {fmt(blocks[blockIdx + 1].seconds)}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
