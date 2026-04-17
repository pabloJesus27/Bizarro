'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TimerConfig, MixBlock } from '@/lib/types'
import { updateWodTimerConfig } from '@/lib/db'
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
import HelpModal from '@/components/HelpModal'
import { useFirstVisit } from '@/hooks/useFirstVisit'

// ── Page ─────────────────────────────────────────────────

function renderTimer(cfg: TimerConfig, onFinish: () => void) {
  if (cfg.type === 'interval')  return <IntervalTimer config={cfg} onFinish={onFinish} />
  if (cfg.type === 'amrap')     return <SimpleTimer label="AMRAP" totalSeconds={cfg.totalSeconds} onFinish={onFinish} />
  if (cfg.type === 'emom')      return <EMOMTimer totalSeconds={cfg.totalSeconds} intervalSeconds={cfg.intervalSeconds} onFinish={onFinish} />
  if (cfg.type === 'fortime')   return <ForTimeTimer capSeconds={cfg.capSeconds} onFinish={onFinish} />
  if (cfg.type === 'countdown') return <SimpleTimer label="COUNTDOWN" totalSeconds={cfg.totalSeconds} onFinish={onFinish} />
  if (cfg.type === 'tabata')    return <TabataTimer workSeconds={cfg.workSeconds} restSeconds={cfg.restSeconds} rounds={cfg.rounds} onFinish={onFinish} />
  if (cfg.type === 'mix')       return <MixTimer blocks={cfg.blocks} onFinish={onFinish} />
  return null
}

function TimerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const manualType = searchParams.get('type')

  const [config, setConfig] = useState<TimerConfig | null>(null)
  const { show: showHelp, dismiss: dismissHelp, open: openHelp } = useFirstVisit('timer-manual')
  const [pendingConfig, setPendingConfig] = useState<TimerConfig | null>(null)
  const [generatedMixBlocks, setGeneratedMixBlocks] = useState<MixBlock[] | null>(null)
  const loadedRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const timerActive = !!(config || generatedMixBlocks || pendingConfig || manualType)

  function handleStart(cfg: TimerConfig) {
    try {
      const raw = sessionStorage.getItem('timer_return_context')
      if (raw) {
        const { wodId } = JSON.parse(raw) as { wodId: string; returnUrl: string }
        const original = pendingConfig ?? (generatedMixBlocks ? { type: 'mix' as const, blocks: generatedMixBlocks } : null)
        if (original && JSON.stringify(cfg) !== JSON.stringify(original)) {
          updateWodTimerConfig(wodId, cfg).catch(() => {})
        }
      }
    } catch { /* ignorar */ }
    setConfig(cfg)
  }

  function handleFinish() {
    try {
      const raw = sessionStorage.getItem('timer_return_context')
      sessionStorage.removeItem('timer_return_context')
      if (raw) {
        const { wodId, returnUrl } = JSON.parse(raw) as { wodId: string; returnUrl: string }
        router.push(`${returnUrl}?result=${wodId}`)
        return
      }
    } catch { /* ignorar */ }
    router.push('/dashboard')
  }

  useEffect(() => {
    if (!timerActive) return
    if (!('wakeLock' in navigator)) return
    async function acquireWakeLock() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {}
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock()
    }
    acquireWakeLock()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
        setPendingConfig(parsed)
      }
    } catch { router.push('/dashboard') }
  }, [router, manualType])

  if (!manualType && !config && !pendingConfig && !generatedMixBlocks) return (
    <main className="min-h-dvh bg-black flex items-center justify-center">
      <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
    </main>
  )

  return (
    <main className="bg-black flex flex-col h-dvh overflow-hidden p-8 sm:p-4">
      <div className="flex items-center justify-between mb-12 sm:mb-2">
        <button
          onClick={() => { if (config) { setConfig(null) } else { router.back() } }}
          className="text-neutral-600 hover:text-white text-sm font-mono transition"
        >
          ← Volver
        </button>

      </div>
      {showHelp && <HelpModal helpKey="timer-manual" onClose={dismissHelp} />}
      <div className="flex-1 flex justify-center items-center overflow-y-auto">
        {config ? (
          <div className="w-full">
            {renderTimer(config, handleFinish)}
          </div>
        ) : (
          <div className="w-full max-w-md sm:max-w-none">
            {generatedMixBlocks && (
              <MixSetup onStart={handleStart} initialBlocks={generatedMixBlocks} />
            )}
            {pendingConfig && !config && (
              <>
                {pendingConfig.type === 'amrap'   && <AMRAPSetup   onStart={handleStart} initialConfig={pendingConfig} />}
                {pendingConfig.type === 'emom'    && <EMOMSetup    onStart={handleStart} initialConfig={pendingConfig} />}
                {pendingConfig.type === 'fortime' && <ForTimeSetup onStart={handleStart} initialConfig={pendingConfig} />}
                {pendingConfig.type === 'tabata'  && <TabataSetup  onStart={handleStart} initialConfig={pendingConfig} />}
              </>
            )}
            {manualType && (
              <>
                {manualType === 'amrap'   && <AMRAPSetup   onStart={handleStart} />}
                {manualType === 'emom'    && <EMOMSetup    onStart={handleStart} />}
                {manualType === 'fortime' && <ForTimeSetup onStart={handleStart} />}
                {manualType === 'tabata'  && <TabataSetup  onStart={handleStart} />}
                {manualType === 'mix'     && <MixSetup     onStart={handleStart} />}
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
      <main className="min-h-dvh bg-black flex items-center justify-center">
        <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:150ms]" /><div className="w-1.5 h-1.5 bg-neutral-600 rounded-full animate-pulse [animation-delay:300ms]" /></div>
      </main>
    }>
      <TimerContent />
    </Suspense>
  )
}
