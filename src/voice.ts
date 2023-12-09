import { randVariance } from './math'
import { CurveConfig, SpaceConfig } from './overrides'
import { CorePartKey, CurvePartKey, DelayPartKey } from './parts'
import { gpt } from './prompt'
import { CORRECTION_PROMPT } from './prompts.ts'
import { choices } from './step-input.ts'
import { getVoicePromptParams, handleVoiceSelection } from './store/choice.ts'
import { $gptResult, $status, $transcript } from './store/status'
import { Axis } from './transforms'
import { World } from './world'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

// @ts-expect-error - it's a UMD global
const responsiveVoice = window.responsiveVoice

export type ListeningStatus = 'disabled' | 'listening' | 'thinking' | 'speaking'

export class VoiceController {
  recognition: SpeechRecognition | null = null
  world: World

  get transcript() {
    return $transcript.get()
  }

  get status() {
    return $status.get()
  }

  rootElement: HTMLDivElement = document.createElement('div')
  displayElement: HTMLDivElement = document.createElement('div')
  transcriptionElement: HTMLDivElement = document.createElement('div')
  statusElement: HTMLDivElement = document.createElement('div')

  recognitionWatchdogTimer: number | null = null

  constructor(world: World) {
    this.world = world
  }

  // If it cannot hear us for 5 seconds, restart the recognition.
  // This prevents the recognition from stalling.
  watchdog() {
    // Reset existing timer
    if (this.recognitionWatchdogTimer !== null) {
      clearTimeout(this.recognitionWatchdogTimer ?? 0)
      this.recognitionWatchdogTimer = null
    }

    const transcript = `${this.transcript}`

    this.recognitionWatchdogTimer = setTimeout(() => {
      if (transcript === this.transcript) {
        // console.log('-- watchdog reset')
        // this.stop()
        // this.start()
      }
    }, 5000)
  }

  // Update the status display
  updateStatus(status: ListeningStatus) {
    $status.set(status)
  }

  setOpenAIKey(key: string) {
    if (!key) return

    localStorage.setItem('OPENAI_KEY', key)
  }

  start() {
    const status = this.status

    if (status !== 'disabled') return

    console.log('> starting recognition')

    this.recognition?.abort()

    this.updateStatus('listening')

    this.createRecognition()
    this.listen()
  }

  listen() {
    try {
      this.recognition?.start()
    } catch (err) {}

    this.updateStatus('listening')
  }

  stop() {
    console.log('> stopped recognition')
    this.updateStatus('disabled')

    this.recognition?.abort()
    this.recognition = null
  }

  toggle() {
    if (this.status === 'disabled') {
      this.start()
      return
    }

    this.stop()
  }

  createRecognition() {
    this.recognition = new SpeechRecognition()
    this.recognition.lang = 'en-SG'
    this.recognition.interimResults = true

    // const grammars = new SpeechGrammarList()
    // grammars.addFromString(SPEECH_GRAMMAR, 10)
    // this.recognition.grammars = grammars

    this.recognition.addEventListener('result', (e) => {
      this.onVoiceResult([...e.results]).then()
    })

    this.recognition.addEventListener('end', (e) => {
      this.stop()
      this.start()
    })
  }

  speak(text: string) {
    if (!responsiveVoice) {
      console.error('ResponsiveVoice not loaded!')
      return
    }

    this.updateStatus('speaking')
    console.log(`> [speaking] ${text}`)

    // don't speak too much.
    const spokenText = text.slice(0, 150)

    responsiveVoice.speak(spokenText, 'US English Male', {
      pitch: 0.2,
      rate: 1,
      onend: () => {
        this.updateStatus('disabled')
        this.stop()
        $transcript.set('')

        setTimeout(() => {
          this.start()
        }, 100)
      },
    })
  }

  async onVoiceResult(results: SpeechRecognitionResult[]) {
    for (const i in results) {
      const result = results[i]

      const alts = [...result]
        .filter((b) => b.confidence > 0.1)
        .sort((a, b) => b.confidence - a.confidence)
        .map((alt) => alt.transcript)

      console.log(`[heard] ${alts.join(', ')}`)

      for (const alt of alts) {
        console.log(`[alt]`, alt)

        const params = getVoicePromptParams()
        console.log(`[params]`, params)

        const msg = JSON.stringify({ input: alt, ...params })
        const result = await gpt(CORRECTION_PROMPT, msg)
        console.log(`[ai]`, result)

        let obj = { choice: null } as {
          choice: string | null
          percent: string | null
        }

        try {
          obj = JSON.parse(result)
        } catch (err) {}

        if (obj.choice) {
          console.log('[selection]', obj.choice)
          handleVoiceSelection(obj.choice, 'choice')
          break
        }

        if (obj.percent) {
          console.log('[selection]', obj.choice)
          handleVoiceSelection(obj.percent, 'percent')
          break
        }
      }
    }
  }

  async execute(input: string) {
    if (!localStorage.getItem('OPENAI_KEY')) {
      console.warn('[ai] missing OPENAI_KEY')
      return
    }

    // const action = await gpt(PROMPT, input)
    $gptResult.set(action)
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
      reset: (v: boolean) => {
        console.log('reset:', v)

        if (v) this.world.panel.reset()
      },

      energy: (data: Partial<Record<CorePartKey, number>>) => {
        console.log('energy:', data)

        for (const key in data) {
          p.energy[key as CorePartKey] = data[key as CorePartKey] ?? 0
        }
      },

      rotation: (data: { x: number; y: number; z: number }) => {
        console.log('rotation:', data)

        for (const key in data) {
          p.rotations[key as Axis] = data[key as Axis]
        }
      },

      synchronicLimbs: (v: number) => {
        console.log('limbs:', v)
        this.setSynchronic(v)
      },

      curve: (data: Partial<CurveConfig>) => {
        for (const key in data) {
          // @ts-expect-error - to fix
          const value = data[key]
          console.log(`curve#${key}:`, value)

          if (['equation', 'threshold'].includes(key)) {
            // @ts-expect-error - to fix
            p.curve[key] = value
          } else if (key === 'axes') {
            for (const axis in value) {
              console.log(`curve.axes#${axis}:`, value[axis])

              p.curve.axes[axis as Axis] = value[axis]
            }
          } else if (key === 'parts') {
            for (const part in value) {
              console.log(`curve.parts#${part}:`, value[part])

              p.curve.parts[part as CurvePartKey] = value[part]
            }
          }
        }

        // set a fallback
        if (data.threshold && !data.equation) {
          p.curve.equation = 'gaussian'
        }
      },

      externalBodySpace: (data: SpaceConfig) => {
        for (const key in data) {
          // @ts-expect-error - to fix
          p.space[key] = data[key]
        }
      },
    } as const

    type HandleKey = keyof typeof handlers

    const out = Object.entries(output).find(([, v]) => v !== null)
    if (!out) return

    const [key, value] = out
    console.log(`set> ${key} =`, value)

    const handler = handlers[key as HandleKey]?.bind(this)

    // @ts-expect-error - to fix
    handler?.(value)

    this.sync(key)
  }

  sync(key: string | string[]) {
    // Sync rotation fields
    if (key.includes('rotation')) {
      this.world.updateParams({ rotation: true })
      return
    }

    this.world.updateParams({ timing: true })
  }

  setSynchronic(v: number) {
    const p = this.world.params
    console.log('synchronic:', v)

    for (const key in p.delays) {
      // variance must be between 0 and 10
      let variance = Math.abs(v)
      variance = Math.min(variance, 10) // max variance is 10.
      variance = Math.max(variance, 0) // min variance is 0.
      p.delays[key as DelayPartKey] = randVariance(variance)
    }
  }
}
