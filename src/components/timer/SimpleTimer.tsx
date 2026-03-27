'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, beep, speak, unlockSilentMode } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'

export default function SimpleTimer({ label, totalSeconds, intervalSeconds }: {
  label: string; totalSeconds: number; intervalSeconds?: number
}) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const remaining = totalSeconds - elapsed

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setElapsed(p => {
        const next = p + 1
        if (next >= totalSeconds) { setRunning(false); setFinished(true) }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, totalSeconds])

  useEffect(() => {
    if (!audioRef.current || elapsed === 0) return
    if (elapsed >= totalSeconds) { beep(audioRef.current, 440, 1.5, 1.0); return }
    if (intervalSeconds && elapsed % intervalSeconds === 0) beep(audioRef.current, 880, 0.3)
    if (remaining === 10) { speak('Diez segundos'); return }
    if (remaining <= 3 && remaining > 0) beep(audioRef.current, remaining === 1 ? 1100 : 880, 1.0)
  }, [elapsed, totalSeconds, remaining, intervalSeconds])

  function handleStart() { unlockSilentMode(); audioRef.current = new AudioContext(); setInPreCountdown(true) }

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
        <p className="text-white font-black text-5xl uppercase tracking-tighter">{label}</p>
        <div className="flex-1 flex items-center justify-center">
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
                <line key={i}
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
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">{elapsed === 0 && !running ? 'Duración' : 'Restante'}</p>
            <p className="text-white font-black text-6xl tabular-nums tracking-tighter leading-none">{fmt(remaining)}</p>
            {!running && !finished && !inPreCountdown && (
              <button onClick={handleStart} className="mt-2 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                {elapsed === 0 ? 'Iniciar' : 'Reanudar'}
              </button>
            )}
            {running && (
              <button onClick={() => setRunning(false)} className="mt-2 border border-neutral-700 text-white font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                Pausar
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
