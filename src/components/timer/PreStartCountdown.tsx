'use client'

import { useEffect, useRef, useState } from 'react'
import { beep, beepGo } from './timer-utils'

export default function PreStartCountdown({ audioCtx, onDone, onCancel }: { audioCtx: AudioContext; onDone: () => void; onCancel?: () => void }) {
  const [count, setCount] = useState(10)
  const doneRef = useRef(false)
  const cancelledRef = useRef(false)

  function handleCancel() {
    cancelledRef.current = true
    onCancel?.()
  }

  useEffect(() => {
    if (doneRef.current) return
    if (count > 0) {
      beep(audioCtx, 660, 0.12, 1.0)
      const id = setTimeout(() => setCount(p => p - 1), 1000)
      return () => clearTimeout(id)
    } else {
      beepGo(audioCtx)
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
