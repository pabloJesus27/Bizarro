'use client'

import AppHeader from './AppHeader'

const DOTS = (
  <div className="flex gap-1.5">
    <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" />
    <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" />
    <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" />
  </div>
)

export function AthletePageLoading({ homeRoute }: { homeRoute?: string } = {}) {
  return (
    <main className="min-h-screen bg-black">
      <AppHeader homeRoute={homeRoute} />
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        {DOTS}
      </div>
    </main>
  )
}

export function CoachPageLoading() {
  return (
    <main className="min-h-screen bg-black">
      <div className="h-16 border-b border-neutral-900" />
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        {DOTS}
      </div>
    </main>
  )
}
