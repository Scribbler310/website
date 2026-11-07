// Sound effects synthesized with the Web Audio API, so there are no audio files.
class Sounds {
  ctx = null
  muted = false

  // Browsers only allow audio after a click or key press
  unlock() {
    this.ctx ??= new AudioContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  tone({ type = 'sine', from, to = from, volume, length, delay = 0 }) {
    const now = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(to, now + length)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + length)
    osc.connect(gain).connect(this.ctx.destination)
    osc.start(now)
    osc.stop(now + length)
  }

  turn() {
    if (this.muted) return
    this.unlock()
    this.tone({ type: 'triangle', from: 520, to: 180, volume: 0.22, length: 0.12 })
    this.tone({ from: 1400, to: 900, volume: 0.05, length: 0.05 })
  }

  // Quiet tick during a scramble. Stays silent until audio is unlocked.
  tick() {
    if (this.muted || this.ctx?.state !== 'running') return
    this.tone({ type: 'triangle', from: 700, to: 300, volume: 0.06, length: 0.05 })
  }

  victory() {
    if (this.muted) return
    this.unlock()
    const notes = [392, 493.88, 587.33, 783.99, 987.77]
    notes.forEach((from, i) => {
      this.tone({ from, volume: 0.14, length: 1, delay: i * 0.1 })
    })
  }
}

export const sounds = new Sounds()
