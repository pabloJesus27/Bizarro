'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, beep, beepGo, beepWarning, keepAudioContextAlive } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'
import type { MixBlock } from '@/lib/types'

export default function MixTimer({ blocks }: { blocks: MixBlock[] }) {
  const [blockIdx, setBlockIdx] = useState(0)
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const current = blocks[blockIdx]
  const isCountUp = !!(current?.countUp)
  const blockDuration = (isCountUp && (current?.seconds ?? 0) === 0) ? 0 : Math.max(1, current?.seconds ?? 1)
  const remaining = current ? Math.max(0, blockDuration - elapsed) : 0

  // EMOM: interval-by-interval display
  const isEmom = !!(current?.intervalSeconds)
  const emomIntSecs = current?.intervalSeconds ?? 1
  const emomTotalIntervals = isEmom ? Math.floor(blockDuration / emomIntSecs) : 0
  const emomCurrentInterval = isEmom ? Math.min(Math.floor(elapsed / emomIntSecs) + 1, emomTotalIntervals) : 0
  const emomIntervalRemaining = isEmom ? emomIntSecs - (elapsed % emomIntSecs) : 0

  // Tabata: work/rest alternation
  const isTabata = !!(current?.tabataWork && current?.tabataRest)
  const tabWork = current?.tabataWork ?? 20
  const tabRest = current?.tabataRest ?? 10
  const tabCycle = tabWork + tabRest
  const tabTotalRounds = isTabata ? Math.floor(blockDuration / tabCycle) : 0
  const tabCurrentRound = isTabata ? Math.min(Math.floor(elapsed / tabCycle) + 1, tabTotalRounds) : 0
  const tabPhaseElapsed = isTabata ? elapsed % tabCycle : 0
  const tabIsWork = tabPhaseElapsed < tabWork
  const tabPhaseRemaining = isTabata ? (tabIsWork ? tabWork - tabPhaseElapsed : tabCycle - tabPhaseElapsed) : 0

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(id)
  }, [running, blockIdx])

  useEffect(() => {
    if (!running || blockDuration === 0 || elapsed < blockDuration) return
    if (blockIdx + 1 >= blocks.length) {
      setRunning(false)
      setFinished(true)
      if (audioRef.current) beepGo(audioRef.current)
    } else {
      setBlockIdx(i => i + 1)
      setElapsed(0)
      if (audioRef.current) beepGo(audioRef.current)
    }
  }, [elapsed, running, blockIdx, blocks.length, blockDuration])

  // Beeps para EMOM
  useEffect(() => {
    if (!isEmom || !audioRef.current || elapsed === 0 || !running) return
    if (elapsed % emomIntSecs === 0) {
      beepGo(audioRef.current)
    } else if (emomIntervalRemaining === 10) {
      beepWarning(audioRef.current)
    } else if (emomIntervalRemaining <= 3 && emomIntervalRemaining > 0) {
      beep(audioRef.current, emomIntervalRemaining === 1 ? 1100 : 880, 1.0)
    }
  }, [elapsed, isEmom, emomIntSecs, emomIntervalRemaining, running])

  // Beeps para Tabata (cambio de fase)
  useEffect(() => {
    if (!isTabata || !audioRef.current || elapsed === 0 || !running) return
    if (elapsed % tabCycle === 0 || elapsed % tabCycle === tabWork) {
      beepGo(audioRef.current)
    } else if (tabPhaseRemaining === 10) {
      beepWarning(audioRef.current)
    } else if (tabPhaseRemaining <= 3 && tabPhaseRemaining > 0) {
      beep(audioRef.current, tabPhaseRemaining === 1 ? 1100 : 880, 1.0)
    }
  }, [elapsed, isTabata, tabCycle, tabWork, tabPhaseRemaining, running])

  // Aviso 30 segundos y 10 segundos (bloques simples, solo countdown)
  useEffect(() => {
    if (!running || !audioRef.current || isEmom || isTabata || isCountUp) return
    if (remaining === 10) { beepWarning(audioRef.current); return }
    if (remaining <= 3 && remaining > 0) { beep(audioRef.current, remaining === 1 ? 1100 : 880, 1.0); return }
    if (remaining === 30 && blockDuration > 30) {
      beep(audioRef.current, 660, 0.15, 1.0)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 1.0), 250)
    }
  }, [remaining, running, blockDuration, isEmom, isTabata, isCountUp])

  function handleStart() {
    if (!audioRef.current) { const ctx = new AudioContext(); audioRef.current = ctx; keepAudioContextAlive(ctx) }
    if (blockIdx === 0 && elapsed === 0) { setInPreCountdown(true) } else { setRunning(true) }
  }

  // Texto central del reloj
  const clockLabel = isEmom
    ? `Intervalo ${emomCurrentInterval}/${emomTotalIntervals}`
    : isTabata
    ? `${tabIsWork ? 'Trabajo' : 'Descanso'} ${tabCurrentRound}/${tabTotalRounds}`
    : isCountUp
    ? 'Tiempo'
    : 'Restante'

  const clockTime = isEmom
    ? fmt(emomIntervalRemaining)
    : isTabata
    ? fmt(tabPhaseRemaining)
    : isCountUp
    ? fmt(elapsed)
    : fmt(remaining)

  return (
    <>
      {inPreCountdown && audioRef.current && (
        <PreStartCountdown audioCtx={audioRef.current} onDone={() => { setInPreCountdown(false); setRunning(true) }} />
      )}
      {finished && (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 gap-8">
          <p className="text-white font-black text-7xl uppercase tracking-tighter">TIME!</p>
          <button onClick={() => router.push('/dashboard')} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-sm hover:border-white transition">Terminar</button>
        </div>
      )}
      <div className="flex flex-col items-center min-h-[calc(100vh-160px)]">
        <p className="text-white font-black text-5xl uppercase tracking-tighter">{current?.label}</p>
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mt-1">
          Bloque {blockIdx + 1} / {blocks.length}
        </p>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-[min(28rem,85vw)] h-[min(28rem,85vw)]">
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
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">{clockLabel}</p>
                <p className="text-white font-black text-6xl tabular-nums tracking-tighter leading-none">{clockTime}</p>
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
