export function keepAudioContextAlive(ctx: AudioContext) {
  // Auto-resume si Android suspende el contexto
  ctx.onstatechange = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  }
  // Oscilador infrasónico (~0dB) que corre indefinidamente para que Android
  // no duerma el AudioContext entre beeps largos (bloques de 2+ minutos)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  gain.gain.value = 0.0001  // inaudible
  osc.frequency.value = 1   // 1Hz, fuera del rango audible
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
}

// Pre-programa beeps para un bloque usando el reloj del AudioContext (inmune a throttling JS)
export function scheduleBlockBeeps(ctx: AudioContext, blockDuration: number, offsetSeconds: number): OscillatorNode[] {
  const nodes: OscillatorNode[] = []
  const base = ctx.currentTime + offsetSeconds

  function schedOsc(freq: number, dur: number, at: number, vol = 1.0) {
    if (at <= ctx.currentTime) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur)
    osc.start(at)
    osc.stop(at + dur)
    nodes.push(osc)
  }

  // Aviso 30 segundos: doble beep
  if (blockDuration > 35) {
    const t30 = base + blockDuration - 30
    schedOsc(660, 0.15, t30)
    schedOsc(660, 0.15, t30 + 0.25)
  }

  // Aviso 10 segundos: triple beep
  if (blockDuration > 12) {
    const t = base + blockDuration - 10
    schedOsc(880, 0.15, t)
    schedOsc(880, 0.15, t + 0.2)
    schedOsc(880, 0.15, t + 0.4)
  }

  // Cuenta atrás 3, 2, 1
  if (blockDuration > 3) {
    schedOsc(880,  0.3, base + blockDuration - 3)
    schedOsc(880,  0.3, base + blockDuration - 2)
    schedOsc(1100, 0.3, base + blockDuration - 1)
  }

  return nodes
}

export function cancelScheduledBeeps(nodes: OscillatorNode[], ctx?: AudioContext) {
  const stopAt = ctx ? ctx.currentTime : 0
  nodes.forEach(osc => { try { osc.stop(stopAt) } catch {} })
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
