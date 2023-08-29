import {World} from './world.js'
import {gpt} from './prompt.js'
import {randVariance} from './math.js'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

export class VoiceController {
  recognition = null
  active = false

  /** @type {World} */
  world

  transcript = ''

  /**
   * @param {World} world
   */
  constructor(world) {
    this.world = world
  }

  start() {
    if (this.active) return
    console.log('> starting recognition')

    if (this.recognition) this.recognition.abort()

    this.active = true

    this.createRecognition()
    this.recognition.start()
  }

  stop() {
    console.log('> stopped recognition')

    if (this.recognition) this.recognition.abort()

    this.active = false
    this.recognition = null
  }

  toggle() {
    if (!this.active) {
      this.start()
      return
    }

    this.stop()
  }

  createRecognition() {
    this.recognition = new SpeechRecognition()
    this.recognition.lang = 'en-US'
    this.recognition.interimResults = true

    this.recognition.addEventListener('result', (e) => {
      this.transcript = [...e.results].map((r) => r?.[0]?.transcript).join('')
      console.log('$', this.transcript)
    })

    this.recognition.addEventListener('end', () => {
      this.handleVoice().then()
    })
  }

  /**
   * @param {string} text
   */
  speak(text) {
    if (!responsiveVoice) {
      console.error('ResponsiveVoice not loaded!')
      return
    }

    responsiveVoice.speak(text, 'US English Male', {
      pitch: 0.2,
      rate: 1,
      onend: () => {
        if (this.recognition) this.recognition.start()
      },
    })
  }

  async handleVoice() {
    const text = this.transcript
    this.transcript = ''

    if (!this.active) return

    const prompt = `
      This is the system that evaluate the input, and generate a JSON code with these variables:
      - energyHead, energyBody, energyFoot, reset
      - rotationX, rotationY, rotationZ
      - synchronicLimbs, axisPoint, externalBodySpace, circleAndCurve.

      All value should be an integer.
      If the variable is not mentioned, give null as default.
    `.trim()

    console.log('human:', text)
    this.speak(text)

    const cmd = await gpt(prompt, text)
    console.log('ai:', cmd)

    let output = null

    try {
      output = JSON.parse(cmd)
    } catch (err) {}

    if (!output) {
      console.warn('> invalid command:', cmd)
      this.speak(`I don't understand.`)
      return
    }

    const p = this.world.params

    const handlers = {
      // energy: (v) => {
      //   p.energy.body = v
      //   p.energy.head = v
      //   p.energy.legs = v
      // },

      energyHead: (v) => {
        p.energy.head = v
      },

      energyBody: (v) => {
        p.energy.body = v
      },

      energyFoot: (v) => {
        p.energy.foot = v
      },

      rotationX: (v) => {
        p.rotations.x = v
      },

      rotationY: (v) => {
        p.rotations.y = v
      },

      rotationZ: (v) => {
        p.rotations.z = v
      },

      synchronicLimbs: (v) => {
        this.setSynchronic(v)
      },

      reset: (v) => {
        this.world.panel.reset()
      },
    }

    const out = Object.entries(output).find(([k, v]) => v !== null)
    if (!out) return

    const [key, value] = out
    console.log(`set> ${key} = ${value}`)

    const handler = handlers[key]?.bind(this)
    handler?.(value)

    this.sync(key)
  }

  sync(key) {
    // Sync rotation fields
    if (key.includes('rotation')) {
      this.world.updateParams({rotation: true})
      return
    }

    this.world.updateParams({core: true})
  }

  setSynchronic(v) {
    const p = this.world.params
    console.log('synchronic:', v)

    for (const key in p.delays) {
      p.delays[key] = randVariance(v)
    }
  }
}
