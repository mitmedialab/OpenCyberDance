import { AnimationMixer } from 'three'

export class Fader {
  current = 'none'

  /** @type {AnimationMixer} */
  mixer = null

  /** @param {AnimationMixer} mixer */
  constructor(mixer) {
    this.current = null
    this.mixer = mixer
  }

  start(start, end, duration) {
    if (this.current === 'idle' || !start || !end) {
      executeCrossFade(start, end, duration)
    } else {
      synchronizeCrossFade(start, end, duration)
    }

    if (!end) {
      this.current = 'none'
      return
    }

    const clip = end.getClip()
    this.current = clip.name
  }

  _sync(startAction, endAction, duration) {
    mixer.addEventListener('loop', onLoopFinished)

    onLoopFinished = (event) => {
      if (event.action === startAction) {
        mixer.removeEventListener('loop', onLoopFinished)

        executeCrossFade(startAction, endAction, duration)
      }
    }
  }

  _execute(startAction, endAction, duration) {
    if (!endAction) {
      startAction?.fadeOut(duration)
      return
    }

    endAction.time = 0

    if (!startAction) {
      endAction.fadeIn(duration)
      return
    }

    startAction.crossFadeTo(endAction, duration, true)
  }
}
