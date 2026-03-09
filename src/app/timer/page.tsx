'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────

type TimerConfig =
  | { type: 'amrap';    totalSeconds: number }
  | { type: 'emom';     totalSeconds: number }
  | { type: 'fortime';  capSeconds: number }
  | { type: 'tabata';   workSeconds: number; restSeconds: number; rounds: number }
  | { type: 'mix';      blocks: MixBlock[] }
  | { type: 'interval'; totalSeconds: number; intervalSeconds: number; workLabel: string; restLabel: string; startWithRest: boolean }
  | { type: 'countdown'; totalSeconds: number }

type MixBlock = { label: string; seconds: number }

// ── Helpers ───────────────────────────────────────────────

function fmt(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function beep(ctx: AudioContext, freq = 880, dur = 0.3, vol = 0.5) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  osc.start()
  osc.stop(ctx.currentTime + dur)
}

// ── Pre-start 10s countdown ───────────────────────────────

function PreStartCountdown({ audioCtx, onDone }: { audioCtx: AudioContext; onDone: () => void }) {
  const [count, setCount] = useState(10)
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    if (count > 0) {
      beep(audioCtx, 660, 0.12, 0.4)
      const id = setTimeout(() => setCount(p => p - 1), 1000)
      return () => clearTimeout(id)
    } else {
      beep(audioCtx, 1100, 0.5, 0.8)
      doneRef.current = true
      const id = setTimeout(onDone, 700)
      return () => clearTimeout(id)
    }
  }, [count, audioCtx, onDone])

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      {count === 0 ? (
        <p className="text-white font-black text-9xl uppercase tracking-tighter">GO!</p>
      ) : (
        <>
          <p className="text-neutral-600 text-xs uppercase tracking-widest font-mono mb-6">Preparado...</p>
          <p className="text-white font-black text-9xl tabular-nums leading-none">{count}</p>
        </>
      )}
    </div>
  )
}

// ── Simple countdown (AMRAP, EMOM, countdown) ────────────

function SimpleTimer({ label, totalSeconds, onMinuteTick }: {
  label: string; totalSeconds: number; onMinuteTick?: boolean
}) {
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
    if (elapsed >= totalSeconds) { beep(audioRef.current, 440, 1.5, 0.8); return }
    if (onMinuteTick && elapsed % 60 === 0) beep(audioRef.current, 880, 0.3)
    if (remaining <= 3 && remaining > 0) beep(audioRef.current, remaining === 1 ? 1100 : 880, 0.15)
  }, [elapsed, totalSeconds, remaining, onMinuteTick])

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
        <p className="text-white font-black text-5xl uppercase tracking-tighter">{label}</p>
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

// ── For Time ──────────────────────────────────────────────

function ForTimeTimer({ capSeconds }: { capSeconds: number }) {
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

// ── Tabata ────────────────────────────────────────────────

function TabataTimer({ workSeconds, restSeconds, rounds }: { workSeconds: number; restSeconds: number; rounds: number }) {
  const [phase, setPhase] = useState<'work' | 'rest'>('work')
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const phaseDuration = phase === 'work' ? workSeconds : restSeconds
  const phaseRemaining = phaseDuration - phaseElapsed

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
            if (audioRef.current) beep(audioRef.current, 660, 0.3, 0.6)
          } else {
            // rest done, next round or finish
            if (currentRound >= rounds) {
              setRunning(false)
              setFinished(true)
              if (audioRef.current) beep(audioRef.current, 440, 1.5, 0.8)
            } else {
              setCurrentRound(r => r + 1)
              setPhase('work')
              setPhaseElapsed(0)
              if (audioRef.current) beep(audioRef.current, 880, 0.2, 0.8)
            }
          }
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, phase, workSeconds, restSeconds, currentRound, rounds])

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
        <p className="text-white font-black text-5xl uppercase tracking-tighter">Tabata</p>
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

// ── Mix ───────────────────────────────────────────────────

function MixTimer({ blocks }: { blocks: MixBlock[] }) {
  const [blockIdx, setBlockIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const current = blocks[blockIdx]
  const remaining = current ? current.seconds - elapsed : 0

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= (current?.seconds ?? 0)) {
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
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, blockIdx, blocks, current])

  useEffect(() => {
    if (!running || !audioRef.current) return
    if (remaining === 30 && current && current.seconds > 30) {
      beep(audioRef.current, 660, 0.15, 0.5)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 0.5), 250)
    }
  }, [remaining, running, current])

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

// ── Interval timer ────────────────────────────────────────

function IntervalTimer({ config }: { config: Extract<TimerConfig, { type: 'interval' }> }) {
  const { totalSeconds, intervalSeconds, workLabel, restLabel, startWithRest } = config

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
      beep(audioRef.current, 440, 2.0, 0.8); return
    }
    const rem = intervalSeconds - (elapsed % intervalSeconds)
    if (rem === 30 && elapsed > 0) {
      beep(audioRef.current, 660, 0.15, 0.5)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 0.5), 250)
    } else if (elapsed > 0 && elapsed % intervalSeconds === 0) {
      beep(audioRef.current, 880, 0.2, 0.8)
      setTimeout(() => beep(audioRef.current!, 880, 0.2, 0.8), 300)
      setTimeout(() => beep(audioRef.current!, 1100, 0.6, 0.8), 600)
    }
  }, [elapsed, intervalSeconds, totalSeconds])

  function handleStart() { audioRef.current = new AudioContext(); setInPreCountdown(true) }

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
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
          <p className="text-white font-black text-7xl uppercase tracking-tighter">TIME!</p>
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

// ── Setup screens ─────────────────────────────────────────

function NumInput({ label, value, onChange, min = 1, max = 99 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-neutral-600 text-xs font-mono uppercase tracking-widest">{label}</label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 border border-neutral-700 rounded-lg text-white font-black text-lg hover:border-white transition"
        >−</button>
        <span className="text-white font-black text-4xl tabular-nums w-16 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 border border-neutral-700 rounded-lg text-white font-black text-lg hover:border-white transition"
        >+</button>
      </div>
    </div>
  )
}

function AMRAPSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [minutes, setMinutes] = useState(20)
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">AMRAP</p>
      <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-72">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">As Many Rounds As Possible</p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="number"
            min={1}
            max={60}
            value={minutes}
            onFocus={e => e.target.select()}
            onChange={e => setMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
            className="w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums"
          />
          <p className="text-neutral-400 text-sm font-mono">minutos</p>
        </div>
      </div>
      <Connector />
      <ClockFace display={fmt(minutes * 60)} label="Duración" onStart={() => onStart({ type: 'amrap', totalSeconds: minutes * 60 })} />
    </div>
  )
}

function ClockFace({ display, label, onStart }: { display: string; label: string; onStart: () => void }) {
  return (
    <div className="relative w-72 h-72">
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
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">{label}</p>
        <p className="text-white font-black text-5xl tabular-nums tracking-tighter leading-none">{display}</p>
        <button onClick={onStart} className="mt-1 bg-white text-black font-black uppercase tracking-widest px-6 py-2 rounded-xl text-xs">
          Listo
        </button>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-px h-2 bg-neutral-700" />
      <div className="w-px h-2 bg-neutral-600" />
      <div className="w-px h-2 bg-neutral-700" />
    </div>
  )
}

function EMOMSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
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
      <ClockFace display={fmt(totalSeconds)} label="Duración" onStart={() => onStart({ type: 'emom', totalSeconds })} />
    </div>
  )
}

function ForTimeSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [hasCap, setHasCap] = useState(false)
  const [capMinutes, setCapMinutes] = useState(20)
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">For Time</p>
      <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-72">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Complete the workout as fast as possible</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setHasCap(v => !v)} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${hasCap ? 'bg-white border-white' : 'border-neutral-600'}`}>
              {hasCap && <span className="text-black text-xs font-black">✓</span>}
            </div>
            <span className="text-neutral-400 text-sm font-mono">Time cap</span>
          </button>
          <input
            type="number"
            min={1}
            max={60}
            value={capMinutes}
            disabled={!hasCap}
            onFocus={e => e.target.select()}
            onChange={e => setCapMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
            className={`w-16 bg-neutral-900 font-black text-xl text-center border rounded-lg px-3 py-2 focus:outline-none tabular-nums transition ${hasCap ? 'text-white border-neutral-700 focus:border-white' : 'text-neutral-700 border-neutral-800 cursor-not-allowed'}`}
          />
          <p className={`text-sm font-mono transition ${hasCap ? 'text-neutral-400' : 'text-neutral-700'}`}>min</p>
        </div>
      </div>
      <Connector />
      <ClockFace
        display={hasCap ? fmt(capMinutes * 60) : '00:00'}
        label={hasCap ? 'Time cap' : 'Sin límite'}
        onStart={() => onStart({ type: 'fortime', capSeconds: hasCap ? capMinutes * 60 : 0 })}
      />
    </div>
  )
}

function TabataSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
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

type MixBlockWithId = MixBlock & { id: number }

function MixSetup({ onStart, initialBlocks }: { onStart: (c: TimerConfig) => void; initialBlocks?: MixBlock[] }) {
  const idCounter = useRef(0)
  const [blocks, setBlocks] = useState<MixBlockWithId[]>(() =>
    (initialBlocks ?? []).map(b => ({ ...b, id: ++idCounter.current }))
  )
  const [newLabel, setNewLabel] = useState('')
  const [newMinutes, setNewMinutes] = useState(1)
  const [newSecs, setNewSecs] = useState(0)
  const [showSubTypes, setShowSubTypes] = useState(false)
  const [forTimeCap, setForTimeCap] = useState(false)
  const [emomIntMin, setEmomIntMin] = useState(1)
  const [emomIntSec, setEmomIntSec] = useState(0)
  const [emomRounds, setEmomRounds] = useState(10)
  const emomTotal = (emomIntMin * 60 + emomIntSec) * emomRounds
  const [tabWork, setTabWork] = useState(20)
  const [tabRest, setTabRest] = useState(10)
  const [tabRounds, setTabRounds] = useState(8)
  const tabTotal = (tabWork + tabRest) * tabRounds
  const dragIdx = useRef<number | null>(null)

  function addBlock() {
    if (!newLabel.trim()) return
    const seconds = newLabel === 'EMOM' ? emomTotal : newLabel === 'Tabata' ? tabTotal : newMinutes * 60 + newSecs
    setBlocks(prev => [...prev, { id: ++idCounter.current, label: newLabel.trim(), seconds }])
    setNewLabel('')
    setNewMinutes(1)
    setNewSecs(0)
    setShowSubTypes(false)
  }

  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i))
  }

  const total = blocks.reduce((acc, b) => acc + b.seconds, 0)

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white font-black text-5xl uppercase tracking-tighter">Mix</p>
      <div className="border border-neutral-700 rounded-2xl px-6 py-7 flex flex-col gap-5 w-80">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Bloques personalizados</p>

        <div className="flex gap-2">
          {[['Nuevo entr.', 'Nuevo entr.'], ['Trabajo', 'Trabajo'], ['Descanso', 'Descanso']].map(([display, value]) => (
            <button
              key={value}
              onClick={() => {
                if (value === 'Nuevo entr.') {
                  setShowSubTypes(true)
                  setNewLabel('')
                } else {
                  setShowSubTypes(false)
                  setNewLabel(value)
                  setNewMinutes(1)
                  setNewSecs(0)
                }
              }}
              className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-mono text-center leading-tight uppercase tracking-wide whitespace-nowrap transition border ${(value === 'Nuevo entr.' ? showSubTypes : newLabel === value) ? 'border-white text-white' : 'border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500'}`}
            >
              {display}
            </button>
          ))}
        </div>

        {showSubTypes && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {['AMRAP', 'For Time', 'EMOM', 'Tabata'].map(sub => (
                <button
                  key={sub}
                  onClick={() => { setNewLabel(sub); setNewMinutes(sub === 'AMRAP' ? 20 : 5) }}
                  className={`px-1 py-2 rounded-lg text-[10px] font-mono text-center uppercase tracking-wide transition border ${newLabel === sub ? 'border-white text-white' : 'border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500'}`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {newLabel === 'AMRAP' && (
              <div className="flex flex-col gap-3">
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">As Many Rounds As Possible</p>
                <div className="flex items-center justify-center gap-3">
                  <input type="number" min={1} max={60} value={newMinutes} onFocus={e => e.target.select()}
                    onChange={e => setNewMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
                    className="w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums" />
                  <p className="text-neutral-400 text-sm font-mono">minutos</p>
                </div>
              </div>
            )}

            {newLabel === 'For Time' && (
              <div className="flex flex-col gap-3">
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Complete the workout as fast as possible</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setForTimeCap(v => !v)} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${forTimeCap ? 'bg-white border-white' : 'border-neutral-600'}`}>
                      {forTimeCap && <span className="text-black text-xs font-black">✓</span>}
                    </div>
                    <span className="text-neutral-400 text-sm font-mono">Time cap</span>
                  </button>
                  <input type="number" min={1} max={60} value={newMinutes} onFocus={e => e.target.select()}
                    onChange={e => setNewMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
                    disabled={!forTimeCap}
                    className={`w-16 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-white tabular-nums transition ${!forTimeCap ? 'opacity-30 cursor-not-allowed' : ''}`} />
                  <p className={`text-neutral-400 text-sm font-mono transition ${!forTimeCap ? 'opacity-30' : ''}`}>min</p>
                </div>
              </div>
            )}

            {newLabel === 'EMOM' && (
              <div className="flex flex-col gap-3">
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">Every Minute On the Minute</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Intervalo</p>
                    <div className="flex items-center gap-1">
                      <input type="text" inputMode="numeric" maxLength={2} value={String(emomIntMin)}
                        onFocus={e => e.target.select()}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setEmomIntMin(v === '' ? 0 : Math.min(59, Number(v))) }}
                        className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                      <p className="text-neutral-600 text-xs font-mono">min</p>
                      <input type="text" inputMode="numeric" maxLength={2} value={String(emomIntSec)}
                        onFocus={e => e.target.select()}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setEmomIntSec(v === '' ? 0 : Math.min(59, Number(v))) }}
                        className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                      <p className="text-neutral-600 text-xs font-mono">seg</p>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-neutral-800" />
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
                    <input type="number" min={1} max={99} value={emomRounds} onFocus={e => e.target.select()}
                      onChange={e => setEmomRounds(Math.max(1, Math.min(99, Number(e.target.value))))}
                      className="w-14 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-2 py-2 focus:outline-none focus:border-white tabular-nums" />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Total</p>
                  <p className="text-neutral-300 font-black text-lg tabular-nums tracking-tighter">{fmt(emomTotal)}</p>
                </div>
              </div>
            )}

            {newLabel === 'Tabata' && (
              <div className="flex flex-col gap-3">
                <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">High intensity intervals</p>
                <div className="flex items-end justify-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Trabajo</p>
                    <div className="flex items-center gap-1">
                      <input type="number" min={1} max={60} value={tabWork} onFocus={e => e.target.select()}
                        onChange={e => setTabWork(Math.max(1, Math.min(60, Number(e.target.value))))}
                        className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                      <p className="text-neutral-600 text-xs font-mono">seg</p>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-neutral-800" />
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Descanso</p>
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} max={60} value={tabRest} onFocus={e => e.target.select()}
                        onChange={e => setTabRest(Math.max(0, Math.min(60, Number(e.target.value))))}
                        className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                      <p className="text-neutral-600 text-xs font-mono">seg</p>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-neutral-800" />
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Rondas</p>
                    <input type="number" min={1} max={30} value={tabRounds} onFocus={e => e.target.select()}
                      onChange={e => setTabRounds(Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Total</p>
                  <p className="text-neutral-300 font-black text-lg tabular-nums tracking-tighter">{fmt(tabTotal)}</p>
                </div>
              </div>
            )}
          </>
        )}

        {!showSubTypes && !newLabel && (
          <p className="text-neutral-600 text-xs font-mono text-center leading-relaxed">
            Combina bloques de entrenamiento, descanso y diferentes tipos de timer en un solo workout personalizado.
          </p>
        )}

        {!showSubTypes && newLabel && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-neutral-400 text-sm font-mono uppercase tracking-widest">Tiempo :</p>
            <input type="number" min={0} max={59} value={newMinutes} onFocus={e => e.target.select()}
              onChange={e => setNewMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
              onBlur={e => { if (Number(e.target.value) === 0 && newSecs === 0) setNewSecs(30) }}
              className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
            <p className="text-neutral-600 text-xs font-mono">min</p>
            <input type="number" min={0} max={59} value={newSecs} onFocus={e => e.target.select()}
              onChange={e => setNewSecs(Math.max(0, Math.min(59, Number(e.target.value))))}
              onBlur={e => { if (e.target.value === '') setNewSecs(30) }}
              className="w-12 bg-neutral-900 text-white font-black text-xl text-center border border-neutral-700 rounded-lg px-1 py-2 focus:outline-none focus:border-white tabular-nums" />
            <p className="text-neutral-600 text-xs font-mono">seg</p>
          </div>
        )}

        <button
          onClick={addBlock}
          className="w-full border border-neutral-700 text-white font-mono uppercase tracking-widest text-xs py-2 rounded-lg hover:border-white transition"
        >
          + Añadir
        </button>
      </div>

      {blocks.length > 0 && (
        <div className="flex flex-col gap-2 w-80">
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Resumen</p>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-track]:bg-neutral-900 [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
          {blocks.map((b, i) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => { dragIdx.current = i }}
              onDragOver={e => { e.preventDefault() }}
              onDrop={() => {
                const from = dragIdx.current
                if (from === null || from === i) return
                setBlocks(prev => {
                  const next = [...prev]
                  const [moved] = next.splice(from, 1)
                  next.splice(i, 0, moved)
                  return next
                })
                dragIdx.current = null
              }}
              className="flex items-center justify-between border border-neutral-800 rounded-xl px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-neutral-700 hover:text-white transition cursor-grab active:cursor-grabbing">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="2" y1="11" x2="12" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <div>
                  <p className="text-white text-sm font-mono">{b.label}</p>
                  <p className="text-neutral-600 text-xs font-mono">{fmt(b.seconds)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setBlocks(prev => [...prev, { ...prev[i], id: ++idCounter.current }])} className="text-neutral-700 hover:text-white transition">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 11V3a1 1 0 0 1 1-1h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                <button onClick={() => removeBlock(i)} className="text-neutral-700 hover:text-white text-lg font-mono transition">×</button>
              </div>
            </div>
          ))}
          </div>
          <p className="text-neutral-700 text-xs font-mono text-right">Total: {fmt(total)}</p>
        </div>
      )}

      <button
        onClick={() => blocks.length > 0 && onStart({ type: 'mix', blocks: blocks.map(({ id: _, ...b }) => b) })}
        disabled={blocks.length === 0}
        className="w-80 bg-white text-black font-black uppercase tracking-widest py-3 rounded-xl text-sm disabled:opacity-30"
      >
        Listo
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────

function renderTimer(cfg: TimerConfig) {
  if (cfg.type === 'interval')  return <IntervalTimer config={cfg} />
  if (cfg.type === 'amrap')     return <SimpleTimer label="AMRAP" totalSeconds={cfg.totalSeconds} />
  if (cfg.type === 'emom')      return <SimpleTimer label="EMOM" totalSeconds={cfg.totalSeconds} onMinuteTick />
  if (cfg.type === 'fortime')   return <ForTimeTimer capSeconds={cfg.capSeconds} />
  if (cfg.type === 'countdown') return <SimpleTimer label="COUNTDOWN" totalSeconds={cfg.totalSeconds} />
  if (cfg.type === 'tabata')    return <TabataTimer workSeconds={cfg.workSeconds} restSeconds={cfg.restSeconds} rounds={cfg.rounds} />
  if (cfg.type === 'mix')       return <MixTimer blocks={cfg.blocks} />
  return null
}

function TimerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const manualType = searchParams.get('type')

  const [config, setConfig] = useState<TimerConfig | null>(null)
  const [generatedMixBlocks, setGeneratedMixBlocks] = useState<MixBlock[] | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (manualType || loadedRef.current) return
    loadedRef.current = true
    const raw = sessionStorage.getItem('generated_timer_config')
    if (!raw) { router.push('/dashboard'); return }
    sessionStorage.removeItem('generated_timer_config')
    try {
      const parsed = JSON.parse(raw) as TimerConfig
      if (parsed.type === 'mix') {
        setGeneratedMixBlocks(parsed.blocks)
      } else {
        setConfig(parsed)
      }
    } catch { router.push('/dashboard') }
  }, [router, manualType])

  if (!manualType && !config && !generatedMixBlocks) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-px h-10 bg-white animate-pulse" />
    </main>
  )

  return (
    <main className="min-h-screen bg-black flex flex-col p-8">
      <button
        onClick={() => {
          if (config) {
            setConfig(null)
            if (!manualType && !generatedMixBlocks) router.push('/dashboard')
          } else if (generatedMixBlocks) {
            router.push('/dashboard')
          } else {
            router.back()
          }
        }}
        className="text-neutral-600 hover:text-white text-sm font-mono mb-12 transition self-start"
      >
        ← Volver
      </button>
      <div className="flex-1 flex items-start justify-center">
        {config ? (
          <div className="w-full">
            {renderTimer(config)}
          </div>
        ) : (
          <div className="w-full max-w-md">
            {generatedMixBlocks && (
              <MixSetup onStart={setConfig} initialBlocks={generatedMixBlocks} />
            )}
            {manualType && (
              <>
                {manualType === 'amrap'   && <AMRAPSetup   onStart={setConfig} />}
                {manualType === 'emom'    && <EMOMSetup    onStart={setConfig} />}
                {manualType === 'fortime' && <ForTimeSetup onStart={setConfig} />}
                {manualType === 'tabata'  && <TabataSetup  onStart={setConfig} />}
                {manualType === 'mix'     && <MixSetup     onStart={setConfig} />}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export default function TimerPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-px h-10 bg-white animate-pulse" />
      </main>
    }>
      <TimerContent />
    </Suspense>
  )
}
