'use client'

import { useEffect, useRef, useState } from 'react'

export default function PreStartCountdown({ audioCtx, onDone, onCancel }: { audioCtx: AudioContext; onDone: () => void; onCancel?: () => void }) {
  const [count, setCount] = useState(10)
  const doneRef = useRef(false)
  const cancelledRef = useRef(false)

  function handleCancel() {
    cancelledRef.current = true
    onCancel?.()
  }

  // Pre-programa todos los beeps en el AudioContext al montar (inmune a throttling JS en background)
  useEffect(() => {
    const base = audioCtx.currentTime + 0.05
    for (let i = 0; i < 10; i++) {
      const t = base + i
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.frequency.value = 660; osc.type = 'sine'
      gain.gain.setValueAtTime(1.0, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t); osc.stop(t + 0.12)
    }
    // GO: doble beep ascendente
    const goTime = base + 10
    ;[880, 1100].forEach((freq, i) => {
      const t = goTime + i * 0.2
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(1.0, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.start(t); osc.stop(t + 0.5)
    })
  }, [audioCtx])

  useEffect(() => {
    if (doneRef.current) return
    if (count > 0) {
      const id = setTimeout(() => setCount(p => p - 1), 1000)
      return () => clearTimeout(id)
    } else {
      doneRef.current = true
      const id = setTimeout(() => { if (!cancelledRef.current) onDone() }, 700)
      return () => clearTimeout(id)
    }
  }, [count, audioCtx, onDone])

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      {onCancel && (
        <button
          onClick={handleCancel}
          className="absolute text-neutral-600 hover:text-white text-sm font-mono transition"
          style={{ top: 'calc(1.5rem + env(safe-area-inset-top))', left: 'calc(1.5rem + env(safe-area-inset-left))' }}
        >
          ← Volver
        </button>
      )}
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
