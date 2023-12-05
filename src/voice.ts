import { randVariance } from './math'
import { gpt } from './prompt'
import { World } from './world'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

// @ts-expect-error - it's a UMD global
const responsiveVoice = window.responsiveVoice

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

    // Changes the rotation of the axes. Float of 1 to 5. Precision of 3 decimals. Default to 1.
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

    // Circle and curve.
    curve: {
      // Equation of the curve.
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
  recognition: SpeechRecognition | null = null
  active = false
  world: World
  transcript = ''

  constructor(world: World) {
    this.world = world
  }

  setOpenAIKey(key: string) {
    if (!key) return

    localStorage.setItem('OPENAI_KEY', key)
  }

  start() {
    if (this.active) return
    console.log('> starting recognition')

    this.recognition?.abort()

    this.active = true

    this.createRecognition()
    this.recognition?.start()
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

  speak(text: string) {
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

  async execute(input: string) {
    if (!localStorage.getItem('OPENAI_KEY')) {
      console.warn('[ai] missing OPENAI_KEY')
      return
    }

    const action = await gpt(PROMPT, input)
    console.log('[ai]', action)

    let output = null

    try {
      output = JSON.parse(action)
    } catch (err) {
      // TODO: handle error
    }

    if (!output) {
      console.warn('> invalid command:', action)

      return
    }

    const p = this.world.params

    const handlers = {
      reset: (v) => {
        console.log('reset:', v)
        if (v) this.world.panel.reset()
      },

      energy: (data) => {
        console.log('energy:', data)

        for (const key in data) {
          p.energy[key] = data[key]
        }
      },

      rotation: (data) => {
        console.log('rotation:', data)

        for (const key in data) {
          p.rotations[key] = data[key]
        }
      },

      synchronicLimbs: (v) => {
        console.log('limbs:', v)
        this.setSynchronic(v)
      },

      curve: (data) => {
        for (const key in data) {
          const value = data[key]
          console.log(`curve#${key}:`, value)

          if (['equation', 'threshold'].includes(key)) {
            p.curve[key] = value
          } else if (key === 'axes') {
            for (const axis in value) {
              console.log(`curve.axes#${axis}:`, value[axis])
              p.curve.axes[axis] = value[axis]
            }
          } else if (key === 'parts') {
            for (const part in value) {
              console.log(`curve.parts#${part}:`, value[part])
              p.curve.parts[part] = value[part]
            }
          }
        }
      },

      externalBodySpace: (data) => {
        for (const key in data) {
          p.space[key] = data[key]
        }
      },
    }

    const out = Object.entries(output).find(([k, v]) => v !== null)
    if (!out) return

    const [key, value] = out
    console.log(`set> ${key} =`, value)

    const handler = handlers[key]?.bind(this)
    handler?.(value)

    this.sync(key)
  }

  sync(key) {
    // Sync rotation fields
    if (key.includes('rotation')) {
      this.world.updateParams({ rotation: true })
      return
    }

    this.world.updateParams({ timing: true })
  }

  setSynchronic(v) {
    const p = this.world.params
    console.log('synchronic:', v)

    for (const key in p.delays) {
      p.delays[key] = randVariance(v)
    }
  }
}
