'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmt, beep, beepGo, beepWarning, keepAudioContextAlive } from './timer-utils'
import PreStartCountdown from './PreStartCountdown'
import LandscapeDisplay, { useIsLandscape } from './LandscapeDisplay'
import type { MixBlock } from '@/lib/types'

export default function MixTimer({ blocks, onFinish }: { blocks: MixBlock[]; onFinish?: () => void }) {
  const [blockIdx, setBlockIdx] = useState(0)
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [inPreCountdown, setInPreCountdown] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const startEpochRef = useRef<number>(0)
  const beepedW10 = useRef<number>(-1)  // blockIdx en el que ya sonó el aviso de 10s

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') audioRef.current?.resume().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); audioRef.current?.close().catch(() => {}) }
  }, [])

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
    if (running) startEpochRef.current = Date.now() - elapsed * 1000
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, blockIdx])

  // Reset aviso 10s al cambiar de bloque
  useEffect(() => { beepedW10.current = -1 }, [blockIdx])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed(Math.round((Date.now() - startEpochRef.current) / 1000))
    const id = setInterval(tick, 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [running, blockIdx])

  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return
    let wl: { release: () => void } | null = null
    ;(navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => void }> } })
      .wakeLock.request('screen').then(w => { wl = w }).catch(() => {})
    return () => { wl?.release() }
  }, [running])

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

  // Avisos For Time con cap (countUp)
  useEffect(() => {
    if (!running || !audioRef.current || !isCountUp || blockDuration === 0) return
    const remaining = blockDuration - elapsed
    if (remaining === 10) { beepWarning(audioRef.current); return }
    if (remaining <= 3 && remaining > 0) beep(audioRef.current, remaining === 1 ? 1100 : 880, 1.0)
  }, [elapsed, running, isCountUp, blockDuration])

  // Avisos bloques simples countdown — rango para sobrevivir throttling JS
  useEffect(() => {
    if (!running || !audioRef.current || isEmom || isTabata || isCountUp) return
    // Aviso 10s: usa ref para no disparar dos veces si remaining salta de 11 a 9
    if (remaining <= 10 && remaining > 0 && beepedW10.current !== blockIdx) {
      beepWarning(audioRef.current)
      beepedW10.current = blockIdx
      return
    }
    if (remaining <= 3 && remaining > 0) { beep(audioRef.current, remaining === 1 ? 1100 : 880, 1.0); return }
    if (remaining === 30 && blockDuration > 30) {
      beep(audioRef.current, 660, 0.15, 1.0)
      setTimeout(() => beep(audioRef.current!, 660, 0.15, 1.0), 250)
    }
  }, [remaining, running, blockDuration, isEmom, isTabata, isCountUp, blockIdx])

  const isLandscape = useIsLandscape()

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
    ? (current?.seconds ? `Cap ${fmt(current.seconds)}` : 'Tiempo')
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
      {isLandscape && !inPreCountdown && !finished && (
        <LandscapeDisplay time={clockTime} label={`${current?.label ?? ''} · ${clockLabel}`}>
          {running ? (
            <button onClick={() => setRunning(false)} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">Pausar</button>
          ) : elapsed > 0 ? (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">Reanudar</button>
          ) : (
            <button onClick={handleStart} className="bg-white text-black font-black uppercase tracking-widest px-8 py-3 rounded-xl text-xs">Iniciar</button>
          )}
        </LandscapeDisplay>
      )}
      {inPreCountdown && audioRef.current && (
        <PreStartCountdown audioCtx={audioRef.current} onDone={() => { setInPreCountdown(false); setRunning(true) }} />
      )}
      {finished && (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 gap-8">
          <p className="text-white font-black text-7xl uppercase tracking-tighter">TIME!</p>
          <button onClick={() => onFinish ? onFinish() : router.push('/dashboard')} className="border border-neutral-700 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl text-sm hover:border-white active:scale-95 active:bg-neutral-900 transition">Terminar</button>
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
