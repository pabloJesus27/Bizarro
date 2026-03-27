'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TimerConfig, MixBlock } from '@/lib/types'
import SimpleTimer from '@/components/timer/SimpleTimer'
import ForTimeTimer from '@/components/timer/ForTimeTimer'
import TabataTimer from '@/components/timer/TabataTimer'
import MixTimer from '@/components/timer/MixTimer'
import IntervalTimer from '@/components/timer/IntervalTimer'
import EMOMTimer from '@/components/timer/EMOMTimer'
import AMRAPSetup from '@/components/timer/AMRAPSetup'
import EMOMSetup from '@/components/timer/EMOMSetup'
import ForTimeSetup from '@/components/timer/ForTimeSetup'
import TabataSetup from '@/components/timer/TabataSetup'
import MixSetup from '@/components/timer/MixSetup'

// ── Page ─────────────────────────────────────────────────

function renderTimer(cfg: TimerConfig) {
  if (cfg.type === 'interval')  return <IntervalTimer config={cfg} />
  if (cfg.type === 'amrap')     return <SimpleTimer label="AMRAP" totalSeconds={cfg.totalSeconds} />
  if (cfg.type === 'emom')      return <EMOMTimer totalSeconds={cfg.totalSeconds} intervalSeconds={cfg.intervalSeconds} />
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
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const timerActive = !!(config || generatedMixBlocks || manualType)

  useEffect(() => {
    if (!timerActive) return
    if (!('wakeLock' in navigator)) return
    navigator.wakeLock.request('screen').then(lock => {
      wakeLockRef.current = lock
    }).catch(() => {})
    return () => {
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [timerActive])

  useEffect(() => {
    if (manualType || loadedRef.current) return
    loadedRef.current = true
    const raw = sessionStorage.getItem('generated_timer_config')
    if (!raw) { router.push('/dashboard'); return }
    sessionStorage.removeItem('generated_timer_config')
    try {
      const parsed = JSON.parse(raw) as TimerConfig
      const validTypes = ['amrap', 'emom', 'fortime', 'tabata', 'mix', 'interval', 'countdown']
      if (!parsed || !validTypes.includes(parsed.type)) { router.push('/dashboard'); return }
      if (parsed.type === 'mix') {
        if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) { router.push('/dashboard'); return }
        setGeneratedMixBlocks(parsed.blocks)
      } else {
        setConfig(parsed)
      }
    } catch { router.push('/dashboard') }
  }, [router, manualType])

  if (!manualType && !config && !generatedMixBlocks) return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black flex flex-col p-8">
      <button
        onClick={() => {
          if (config) {
            setConfig(null)
            if (!manualType && !generatedMixBlocks) router.back()
          } else if (generatedMixBlocks) {
            router.back()
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
        <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
      </main>
    }>
      <TimerContent />
    </Suspense>
  )
}
