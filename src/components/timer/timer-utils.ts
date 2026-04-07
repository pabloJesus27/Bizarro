export function keepAudioContextAlive(_ctx: AudioContext) {
  // No-op
}

export function beepWarning(ctx: AudioContext) {
  speak('Diez segundos')
  const play = () => {
    [0, 200, 400].forEach(delay => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(1.0, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      }, delay)
    })
  }
  if (ctx.state === 'suspended') { ctx.resume().then(play).catch(() => {}) } else { play() }
}

export function beepGo(ctx: AudioContext) {
  const play = () => {
    [880, 1100].forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(1.0, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      }, i * 200)
    })
  }
  if (ctx.state === 'suspended') { ctx.resume().then(play).catch(() => {}) } else { play() }
}

export function fmt(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = 0.95
  u.volume = 1
  window.speechSynthesis.speak(u)
}

export function beep(ctx: AudioContext, freq = 880, dur = 0.3, vol = 1.0) {
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
