import { Howl, Howler } from 'howler'
import { atom } from 'nanostores'

Howler.autoSuspend = false
Howler.autoUnlock = true

export const $soundReady = atom(false)
export const $soundError = atom(false)

class SoundManager {
  ding: Howl | null = null

  setup() {
    if ($soundReady.get() === true) return

    this.ding = new Howl({
      src: ['/sounds/khongwong_1.wav'],
      preload: true,
      volume: 1,
      onload: () => {
        console.log(`ss | ding loaded`)
        $soundReady.set(true)
      },
      onloaderror: () => {
        console.error(`ss | failed to load ding`)
        $soundError.set(true)
        $soundReady.set(false)

        try {
          if (this.ding) {
            this.ding.stop()
            this.ding.unload()
          }
        } catch (err) {
          // ???
        }

        this.setup()
      },
      onend: () => {
        console.log('ss | on end')
        $soundReady.set(true)
      },
      onplayerror: () => {
        if (!this.ding) return

        this.ding.once('unlock', function () {
          console.log(`ss | sound unlocked`)

          $soundReady.set(true)
        })
      },
    })
  }

  play() {
    if (!this.ding) return

    this.ding.stop()
    this.ding.play()
  }

  stop() {
    if (!this.ding) return

    this.ding.stop()
  }
}

export const soundManager = new SoundManager()
