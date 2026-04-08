'use client'

import { useState } from 'react'
import type { CoachMessage } from '@/lib/db'

interface Props {
  message: CoachMessage | null
}

export default function CoachMessageBubble({ message }: Props) {
  const [open, setOpen] = useState(false)

  if (!message) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-72 p-5 flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">Del coach</p>
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-500 hover:text-white text-xl leading-none transition"
            >
              &times;
            </button>
          </div>
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:bg-neutral-200 active:scale-95 transition-all"
        aria-label="Ver indicaciones del coach"
      >
        <span className="text-lg">💬</span>
      </button>
    </div>
  )
}
