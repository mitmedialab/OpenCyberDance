const MAX_MEASURE_COUNT = 20

export class FpsCounter {
  lastTime = 0
  frames = 0
  fps = 0
  measureCount = 0
  active = false

  enable() {
    this.lastTime = performance.now()
    this.frames = 0
    this.fps = 0
    this.measureCount = 0
    this.active = true
  }

  disable() {
    this.active = false
  }

  tick() {
    if (!this.active) return
    if (this.measureCount > MAX_MEASURE_COUNT) return

    const now = performance.now()
    const delta = now - this.lastTime

    this.measureCount++
    this.frames++

    if (delta >= 1000) {
      this.fps = frames
      this.frames = 0
      this.lastTime = now
    }
  }
}

export const fpsCounter = new FpsCounter()
