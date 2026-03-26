'use client'

import { useEffect, useRef, useState } from 'react'
import { beep } from './timer-utils'

export default function PreStartCountdown({ audioCtx, onDone }: { audioCtx: AudioContext; onDone: () => void }) {
  const [count, setCount] = useState(10)
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    if (count > 0) {
      beep(audioCtx, 660, 0.12, 1.0)
      const id = setTimeout(() => setCount(p => p - 1), 1000)
      return () => clearTimeout(id)
    } else {
      beep(audioCtx, 1100, 0.5, 1.0)
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
