// Pool de <audio> para beeps en iOS (HTMLAudioElement usa media category
// y suena aunque el móvil esté en silencio, a diferencia de Web Audio API).
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
const POOL_SIZE = 6
let pool: HTMLAudioElement[] = []
let poolIdx = 0

function getPoolAudio(): HTMLAudioElement {
  if (pool.length === 0) {
    pool = Array.from({ length: POOL_SIZE }, () => new Audio('/beep.wav'))
  }
  const a = pool[poolIdx % POOL_SIZE]
  poolIdx++
  return a
}

export function keepAudioContextAlive(_ctx: AudioContext) {
  // No-op: en iOS usamos el pool de <audio> en su lugar
}

export function fmt(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // iOS Safari: speechSynthesis interfiere con WebAudio y suspende el AudioContext
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = 0.95
  u.volume = 1
  window.speechSynthesis.speak(u)
}

export function beep(ctx: AudioContext, freq = 880, dur = 0.3, vol = 1.0) {
  if (isIOS) {
    const a = getPoolAudio()
    a.currentTime = 0
    a.volume = Math.min(1, vol)
    a.play().catch(() => {})
    return
  }
  const play = () => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start()
    osc.stop(ctx.currentTime + dur)
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {})
  } else {
    play()
  }
}
