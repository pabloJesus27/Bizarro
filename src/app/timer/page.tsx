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
      <div className="flex flex-col items-center gap-8">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">{label}</p>
        <div className={`font-black tabular-nums leading-none tracking-tighter ${finished ? 'text-neutral-600' : 'text-white'} text-9xl`}>
          {finished ? 'TIME!' : fmt(remaining)}
        </div>
        {running && !finished && <p className="text-neutral-700 font-mono text-sm">{fmt(elapsed)} transcurrido</p>}
        <div className="flex gap-4">
          {!running && !finished && !inPreCountdown && (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-xl">
              {elapsed === 0 ? 'Iniciar' : 'Reanudar'}
            </button>
          )}
          {running && (
            <button onClick={() => setRunning(false)} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-4 rounded-xl text-sm">
              Pausar
            </button>
          )}
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
      <div className="flex flex-col items-center gap-8">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">FOR TIME</p>
        {capSeconds > 0 && <p className="text-neutral-600 text-xs font-mono">Time cap: {fmt(capSeconds)}</p>}
        <div className={`font-black tabular-nums leading-none tracking-tighter text-9xl ${cappedOut ? 'text-neutral-600' : stopped ? 'text-neutral-300' : 'text-white'}`}>
          {fmt(elapsed)}
        </div>
        {(cappedOut || stopped) && (
          <p className="text-white font-black text-xl uppercase tracking-widest">
            {cappedOut ? 'TIME CAP' : `Tiempo: ${fmt(elapsed)}`}
          </p>
        )}
        <div className="flex gap-4">
          {!running && !stopped && !cappedOut && !inPreCountdown && (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-xl">
              {elapsed === 0 ? 'Iniciar' : 'Reanudar'}
            </button>
          )}
          {running && (
            <button onClick={stop} className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-xl">Stop</button>
          )}
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
      <div className="flex flex-col items-center gap-6 text-center">
        <div className={`inline-flex border rounded-full px-5 py-1 ${phase === 'work' ? 'border-white' : 'border-neutral-700'}`}>
          <p className={`text-xs uppercase tracking-widest font-mono ${phase === 'work' ? 'text-white' : 'text-neutral-500'}`}>
            {phase === 'work' ? 'Trabajo' : 'Descanso'}
          </p>
        </div>
        <div className="text-white font-black text-9xl tracking-tighter tabular-nums leading-none">
          {fmt(phaseRemaining)}
        </div>
        <p className="text-neutral-500 font-mono text-sm">Ronda {currentRound} / {rounds}</p>
        <div className="flex gap-4 mt-4">
          {!running && !finished && !inPreCountdown && (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-xl">
              {phaseElapsed === 0 && currentRound === 1 ? 'Iniciar' : 'Reanudar'}
            </button>
          )}
          {running && (
            <button onClick={() => setRunning(false)} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">
              Pausar
            </button>
          )}
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
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">
          Bloque {blockIdx + 1} / {blocks.length}
        </p>
        <h2 className="text-white font-black text-3xl uppercase tracking-tighter">{current?.label}</h2>
        <div className="text-white font-black text-9xl tracking-tighter tabular-nums leading-none">
          {fmt(remaining)}
        </div>
        {blockIdx + 1 < blocks.length && (
          <p className="text-neutral-600 text-xs font-mono">
            Siguiente: {blocks[blockIdx + 1].label} · {fmt(blocks[blockIdx + 1].seconds)}
          </p>
        )}
        <div className="flex gap-4 mt-4">
          {!running && !finished && !inPreCountdown && (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-xl">
              {blockIdx === 0 && elapsed === 0 ? 'Iniciar' : 'Reanudar'}
            </button>
          )}
          {running && (
            <button onClick={() => setRunning(false)} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">
              Pausar
            </button>
          )}
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
    <div className="flex flex-col items-center gap-10">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">AMRAP</p>
      <NumInput label="Minutos" value={minutes} onChange={setMinutes} max={60} />
      <button onClick={() => onStart({ type: 'amrap', totalSeconds: minutes * 60 })}
        className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg">
        Iniciar
      </button>
    </div>
  )
}

function EMOMSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [minutes, setMinutes] = useState(10)
  return (
    <div className="flex flex-col items-center gap-10">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">EMOM</p>
      <NumInput label="Minutos" value={minutes} onChange={setMinutes} max={60} />
      <button onClick={() => onStart({ type: 'emom', totalSeconds: minutes * 60 })}
        className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg">
        Iniciar
      </button>
    </div>
  )
}

function ForTimeSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [hasCap, setHasCap] = useState(false)
  const [capMinutes, setCapMinutes] = useState(20)
  return (
    <div className="flex flex-col items-center gap-10">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">FOR TIME</p>
      <button onClick={() => setHasCap(v => !v)} className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${hasCap ? 'bg-white border-white' : 'border-neutral-600'}`}>
          {hasCap && <span className="text-black text-xs font-black">✓</span>}
        </div>
        <span className="text-white text-sm font-mono">Time cap</span>
      </button>
      {hasCap && <NumInput label="Minutos" value={capMinutes} onChange={setCapMinutes} max={60} />}
      <button onClick={() => onStart({ type: 'fortime', capSeconds: hasCap ? capMinutes * 60 : 0 })}
        className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg">
        Iniciar
      </button>
    </div>
  )
}

function TabataSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [work, setWork] = useState(20)
  const [rest, setRest] = useState(10)
  const [rounds, setRounds] = useState(8)
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">TABATA</p>
      <div className="flex gap-8">
        <NumInput label="Trabajo (seg)" value={work} onChange={setWork} max={60} />
        <NumInput label="Descanso (seg)" value={rest} onChange={setRest} min={0} max={60} />
      </div>
      <NumInput label="Rondas" value={rounds} onChange={setRounds} max={30} />
      <p className="text-neutral-600 text-xs font-mono">Total: {fmt((work + rest) * rounds)}</p>
      <button onClick={() => onStart({ type: 'tabata', workSeconds: work, restSeconds: rest, rounds })}
        className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg">
        Iniciar
      </button>
    </div>
  )
}

function MixSetup({ onStart }: { onStart: (c: TimerConfig) => void }) {
  const [blocks, setBlocks] = useState<MixBlock[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newMinutes, setNewMinutes] = useState(5)

  function addBlock() {
    if (!newLabel.trim()) return
    setBlocks(prev => [...prev, { label: newLabel.trim(), seconds: newMinutes * 60 }])
    setNewLabel('')
    setNewMinutes(5)
  }

  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i))
  }

  const total = blocks.reduce((acc, b) => acc + b.seconds, 0)

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono text-center">MIX</p>

      {/* Blocks list */}
      {blocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center justify-between border border-neutral-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-white text-sm font-mono">{b.label}</p>
                <p className="text-neutral-600 text-xs font-mono">{fmt(b.seconds)}</p>
              </div>
              <button onClick={() => removeBlock(i)} className="text-neutral-700 hover:text-white text-lg font-mono transition">×</button>
            </div>
          ))}
          <p className="text-neutral-700 text-xs font-mono text-right">Total: {fmt(total)}</p>
        </div>
      )}

      {/* Add block */}
      <div className="border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
        <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">Añadir bloque</p>
        <input
          type="text"
          placeholder="Nombre (ej: AMRAP 5 min)"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          className="w-full bg-neutral-900 text-white placeholder-neutral-700 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-white"
        />
        <NumInput label="Minutos" value={newMinutes} onChange={setNewMinutes} max={60} />
        <button
          onClick={addBlock}
          className="w-full border border-neutral-700 text-white font-mono uppercase tracking-widest text-xs py-2 rounded-lg hover:border-white transition"
        >
          + Añadir
        </button>
      </div>

      <button
        onClick={() => blocks.length > 0 && onStart({ type: 'mix', blocks })}
        disabled={blocks.length === 0}
        className="bg-white text-black font-black uppercase tracking-widest px-12 py-5 rounded-xl text-lg disabled:opacity-30"
      >
        Iniciar
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────

function renderTimer(cfg: TimerConfig) {
  if (cfg.type === 'interval')  return <IntervalTimer config={cfg} />
  if (cfg.type === 'amrap')     return <SimpleTimer label={`AMRAP · ${Math.floor(cfg.totalSeconds / 60)} MIN`} totalSeconds={cfg.totalSeconds} />
  if (cfg.type === 'emom')      return <SimpleTimer label={`EMOM · ${Math.floor(cfg.totalSeconds / 60)} MIN`} totalSeconds={cfg.totalSeconds} onMinuteTick />
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

  useEffect(() => {
    if (manualType) return
    const raw = sessionStorage.getItem('generated_timer_config')
    if (!raw) { router.push('/dashboard'); return }
    try { setConfig(JSON.parse(raw)) }
    catch { router.push('/dashboard') }
  }, [router, manualType])

  if (!manualType && !config) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-px h-10 bg-white animate-pulse" />
    </main>
  )

  return (
    <main className="min-h-screen bg-black flex flex-col p-8">
      <button onClick={() => router.back()} className="text-neutral-600 hover:text-white text-sm font-mono mb-12 transition self-start">
        ← Volver
      </button>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {manualType && !config && (
            <>
              {manualType === 'amrap'   && <AMRAPSetup   onStart={setConfig} />}
              {manualType === 'emom'    && <EMOMSetup    onStart={setConfig} />}
              {manualType === 'fortime' && <ForTimeSetup onStart={setConfig} />}
              {manualType === 'tabata'  && <TabataSetup  onStart={setConfig} />}
              {manualType === 'mix'     && <MixSetup     onStart={setConfig} />}
            </>
          )}
          {config && renderTimer(config)}
        </div>
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
