'use client'

import { useEffect, useRef, useState } from 'react'
import { fmt, beep } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'

export default function ForTimeTimer({ capSeconds }: { capSeconds: number }) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const cappedOut = capSeconds > 0 && elapsed >= capSeconds

  useEffect(() => {
    if (!running || cappedOut) return
    const id = setInterval(() => setElapsed(p => p + 1), 1000)
    return () => clearInterval(id)
  }, [running, cappedOut])

  useEffect(() => {
    if (cappedOut) { setRunning(false); if (audioRef.current) beep(audioRef.current, 440, 1.5, 0.8) }
  }, [cappedOut])

  function handleStart() { audioRef.current = new AudioContext(); setInPreCountdown(true) }
  function stop() { setRunning(false); setStopped(true); if (audioRef.current) beep(audioRef.current, 880, 0.3) }

  return (
    <>
      {inPreCountdown && audioRef.current && (
        <PreStartCountdown audioCtx={audioRef.current} onDone={() => { setInPreCountdown(false); setRunning(true) }} />
      )}
      {cappedOut && (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
          <p className="text-white font-black text-7xl uppercase tracking-tighter">TIME CAP</p>
        </div>
      )}
      <div className="flex flex-col items-center min-h-[calc(100vh-160px)]">
        <p className="text-white font-black text-5xl uppercase tracking-tighter">For Time</p>
        <div className="flex-1 flex items-center justify-center">
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
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">
              {capSeconds > 0 ? `Cap ${fmt(capSeconds)}` : 'Tiempo'}
            </p>
            <p className={`font-black text-6xl tabular-nums tracking-tighter leading-none ${stopped ? 'text-neutral-300' : 'text-white'}`}>
              {fmt(elapsed)}
            </p>
            {stopped && (
              <p className="text-neutral-400 text-xs font-mono uppercase tracking-widest">Listo</p>
            )}
            {!running && !stopped && !cappedOut && !inPreCountdown && (
              <button onClick={handleStart} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                {elapsed === 0 ? 'Iniciar' : 'Reanudar'}
              </button>
            )}
            {running && (
              <button onClick={stop} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                Stop
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  )
}
