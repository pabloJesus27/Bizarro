'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, beep, speak, keepAudioContextAlive } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'
import type { TimerConfig } from '@/lib/types'

export default function IntervalTimer({ config }: { config: Extract<TimerConfig, { type: 'interval' }> }) {
  const { totalSeconds, intervalSeconds, workLabel, restLabel, startWithRest } = config

  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const totalRemaining = Math.max(0, totalSeconds - elapsed)
  const intervalElapsed = elapsed % intervalSeconds
  const intervalRemaining = intervalSeconds - intervalElapsed
  const currentWindow = Math.floor(elapsed / intervalSeconds) + 1
  const totalWindows = Math.floor(totalSeconds / intervalSeconds)
  const isWarning = running && intervalRemaining <= 30 && intervalRemaining > 0

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(p => p + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!audioRef.current) return
    if (elapsed >= totalSeconds && elapsed > 0) {
      setRunning(false); setFinished(true)
      beep(audioRef.current, 440, 2.0, 1.0); return
    }
    const rem = intervalSeconds - (elapsed % intervalSeconds)
    if (rem === 10 && elapsed > 0) { speak('Diez segundos'); return }
    if (rem === 30 && elapsed > 0) {
      beep(audioRef.current, 660, 0.15, 1.0)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 1.0), 250)
    } else if (elapsed > 0 && elapsed % intervalSeconds === 0) {
      beep(audioRef.current, 880, 0.2, 1.0)
      setTimeout(() => beep(audioRef.current!, 880, 0.2, 1.0), 300)
      setTimeout(() => beep(audioRef.current!, 1100, 0.6, 1.0), 600)
    }
  }, [elapsed, intervalSeconds, totalSeconds])

  function handleStart() { const ctx = new AudioContext(); audioRef.current = ctx; keepAudioContextAlive(ctx); setInPreCountdown(true) }

  if (!running && !inPreCountdown && elapsed === 0) {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono mb-1">Parada cada</p>
          <p className="text-white font-black text-5xl tracking-tighter">{fmt(intervalSeconds)}</p>
        </div>
        <div className="border border-neutral-800 rounded-xl p-6 max-w-xs w-full text-left">
          <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest mb-3">
            {startWithRest ? 'Comienza con' : 'Al sonar la alarma'}
          </p>
          <p className="text-white font-mono text-sm whitespace-pre-wrap">{restLabel}</p>
        </div>
        <p className="text-neutral-600 font-mono text-xs">Duración total: {fmt(totalSeconds)}</p>
        <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg">
          Iniciar
        </button>
      </div>
    )
  }

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
      <div className="flex flex-col items-center gap-6 text-center">
        <p className={`text-xs uppercase tracking-widest font-mono transition-colors ${isWarning ? 'text-white' : 'text-neutral-600'}`}>
          {isWarning ? '30 segundos' : 'Próxima parada'}
        </p>
        <div className={`font-black text-9xl tracking-tighter tabular-nums leading-none transition-colors ${isWarning ? 'text-neutral-400' : 'text-white'}`}>
          {fmt(intervalRemaining)}
        </div>
        <div className="border border-neutral-800 rounded-full px-5 py-2">
          <p className="text-neutral-400 text-xs uppercase tracking-widest font-mono">{workLabel}</p>
        </div>
        <div className="flex gap-10 mt-2">
          <div className="text-center">
            <p className="text-neutral-700 text-xs font-mono uppercase mb-1">Ventana</p>
            <p className="text-neutral-300 font-black text-xl tabular-nums">{currentWindow}/{totalWindows}</p>
          </div>
          <div className="text-center">
            <p className="text-neutral-700 text-xs font-mono uppercase mb-1">Total restante</p>
            <p className="text-neutral-300 font-black text-xl tabular-nums">{fmt(totalRemaining)}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          {running ? (
            <button onClick={() => setRunning(false)} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">Pausar</button>
          ) : (
            <button onClick={() => setRunning(true)} className="bg-white text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">Reanudar</button>
          )}
        </div>
      </div>
    </>
  )
}
