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
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:bg-neutral-200 active:scale-95 transition-all z-40"
        aria-label="Ver indicaciones del coach"
      >
        <span className="text-lg">💬</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">
                Del coach
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-white text-2xl leading-none transition"
              >
                &times;
              </button>
            </div>
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
