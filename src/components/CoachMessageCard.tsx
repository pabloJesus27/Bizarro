'use client'

import type { CoachMessage } from '@/lib/db'

interface Props {
  message: CoachMessage | null
}

export default function CoachMessageCard({ message }: Props) {
  if (!message) return null

  return (
    <div className="border border-neutral-800 rounded-2xl p-5 flex flex-col gap-3">
      <p className="text-neutral-500 text-xs uppercase tracking-widest font-mono">
        Del coach
      </p>
      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </p>
    </div>
  )
}
