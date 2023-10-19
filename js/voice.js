import {World} from './world.js'
import {gpt} from './prompt.js'
import {randVariance} from './math.js'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

const PROMPT = `
  This is a system that evaluates the natural language command, and generate a JSON code with these variables,
  according to the following TypeScript interface.

  interface VoiceCommand {
    // Reset the system?
    reset: boolean

    // Changes the energy of the head, body or foot. Float of 1 to 8. Precision of 2 decimals. Default to 1.
    // If the body part (head, body, foot) is not specified, set all fields to the given value.
    energy: {
      head: number,
      body: number,
      foot: number,
    }

    // Changes the rotation of the axes. Float of 1 to 1.5. Precision of 3 decimals. Default to 1.
    // If the axis (x, y, z) is not specified, set all axes to the given value.
    rotation: {
      x: number,
      y: number,
      z: number,
    }

    // Integer between -10 and 10. Default to 0.
    synchronicLimbs: number

    externalBodySpace: {
      // Float of 0 to 3. Precision of 2 decimals.
      delay: number

      // Float of 0 to 0.2. Precision of 3 decimals. Default to 1.
      threshold: number

      // Integer of 1 to 4.
      minWindow: number

      // Integer of 1 to 120.
      windowSize: number
    }

    circle: {
      // Equation of the circle.
      equation: "none" | "lowpass" | "highpass" | "gaussian" | "derivative" | "capMin" | "capMax"

      // Float between 0 and 1. Precision of 2 decimals.
      threshold: number

      axes: {
        // default to true
        x: boolean,

        y: boolean,
        z: boolean
      }

      parts: {
        head: boolean,
        body: boolean,

        // default to true
        leftArm: boolean,

        // default to true
        rightArm: boolean,

        // default to true
        leftLeg: boolean,

        // default to true
        rightLeg: boolean,
      }
    }
  }

  If the variable is not mentioned, omit the key entirely.
`.trim()

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

    if (text) {
      console.log('[human]', text)
      this.speak(text)
      this.execute(text)
    }
  }

  async execute(input) {
    const action = await gpt(PROMPT, input)
    console.log('[ai]', action)

    let output = null

    try {
      output = JSON.parse(action)
    } catch (err) {}

    if (!output) {
      console.warn('> invalid command:', action)

      return
    }

    const p = this.world.params

    const handlers = {
      reset: (v) => {
        console.log('reset:', v)
        this.world.panel.reset()
      },

      energy: (v) => {
        console.log('energy:', v)
        // p.energy.foot = v
      },

      rotation: (v) => {
        console.log('rotation:', v)
        // p.rotations.x = v
      },

      synchronicLimbs: (v) => {
        console.log('limbs:', v)
        this.setSynchronic(v)
      },

      circle: (v) => {
        console.log('circle:', v)
      },

      externalBodySpace: (v) => {
        console.log('space:', v)
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

    this.world.updateParams({timing: true})
  }

  setSynchronic(v) {
    const p = this.world.params
    console.log('synchronic:', v)

    for (const key in p.delays) {
      p.delays[key] = randVariance(v)
    }
  }
}
