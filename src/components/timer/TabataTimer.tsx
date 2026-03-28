'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, beep, beepGo, beepWarning, keepAudioContextAlive } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'

export default function TabataTimer({ workSeconds, restSeconds, rounds }: { workSeconds: number; restSeconds: number; rounds: number }) {
  const router = useRouter()
  const [phase, setPhase] = useState<'work' | 'rest'>('work')
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') audioRef.current?.resume().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); audioRef.current?.close().catch(() => {}) }
  }, [])

  const phaseDuration = phase === 'work' ? workSeconds : restSeconds
  const phaseRemaining = phaseDuration - phaseElapsed

  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return
    let wl: { release: () => void } | null = null
    ;(navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => void }> } })
      .wakeLock.request('screen').then(w => { wl = w }).catch(() => {})
    return () => { wl?.release() }
  }, [running])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setPhaseElapsed(prev => {
        const next = prev + 1
        const duration = phase === 'work' ? workSeconds : restSeconds

        if (next >= duration) {
          if (phase === 'work') {
            // switch to rest
            setPhase('rest')
            setPhaseElapsed(0)
            if (audioRef.current) beepGo(audioRef.current)
          } else {
            // rest done, next round or finish
            if (currentRound >= rounds) {
              setRunning(false)
              setFinished(true)
              if (audioRef.current) beepGo(audioRef.current)
            } else {
              setCurrentRound(r => r + 1)
              setPhase('work')
              setPhaseElapsed(0)
              if (audioRef.current) beepGo(audioRef.current)
            }
          }
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, phase, workSeconds, restSeconds, currentRound, rounds])

  useEffect(() => {
    if (!running || !audioRef.current) return
    const duration = phase === 'work' ? workSeconds : restSeconds
    const remaining = duration - phaseElapsed
    if (remaining <= 3 && remaining > 0) beep(audioRef.current, remaining === 1 ? 1100 : 880, 1.0)
  }, [phaseElapsed, phase, workSeconds, restSeconds, running])

  function handleStart() {
    if (!audioRef.current) { const ctx = new AudioContext(); audioRef.current = ctx; keepAudioContextAlive(ctx) }
    if (phaseElapsed === 0 && currentRound === 1) { setInPreCountdown(true) } else { setRunning(true) }
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
      <div className="flex flex-col items-center min-h-[calc(100vh-160px)]">
        <p className="text-white font-black text-5xl uppercase tracking-tighter">Tabata</p>
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <p className={`text-xs uppercase tracking-widest font-mono ${phase === 'work' ? 'text-white' : 'text-neutral-500'}`}>
              {phase === 'work' ? 'Trabajo' : 'Descanso'}
            </p>
            <p className="text-white font-black text-6xl tabular-nums tracking-tighter leading-none">{fmt(phaseRemaining)}</p>
            <p className="text-neutral-600 text-xs font-mono">Ronda {currentRound} / {rounds}</p>
            {!running && !finished && !inPreCountdown && (
              <button onClick={handleStart} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
                {phaseElapsed === 0 && currentRound === 1 ? 'Iniciar' : 'Reanudar'}
              </button>
            )}
            {running && (
              <button onClick={() => setRunning(false)} className="mt-1 border border-neutral-700 text-white font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
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
