import { randVariance } from './math'
import { CurveConfig, SpaceConfig } from './overrides'
import { CorePartKey, CurvePartKey, DelayPartKey } from './parts'
import { gpt } from './prompt'
import { CORRECTION_PROMPT } from './prompts.ts'
import {
  createGrammarFromState,
  getVoicePromptParams,
  handleVoiceSelection,
  prevStep,
} from './store/choice.ts'
import { $gptResult, $status, $transcript } from './store/status'
import { Axis } from './transforms'
import { World } from './world'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

const SpeechGrammarList =
  window.SpeechGrammarList || window.webkitSpeechGrammarList

// @ts-expect-error - it's a UMD global
const responsiveVoice = window.responsiveVoice

export type ListeningStatus =
  | 'disabled'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'confused'

export class VoiceController {
  recognition: SpeechRecognition | null = null
  world: World

  get transcript() {
    return $transcript.get()
  }

  get status() {
    return $status.get()
  }

  constructor(world: World) {
    this.world = world
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

    this.recognition?.abort()
    this.createRecognition()
    this.listen()
  }

  listen() {
    try {
      this.recognition?.start()
    } catch (err) {}
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
    this.recognition.maxAlternatives = 3

    const targetGrammar = createGrammarFromState()

    if (targetGrammar) {
      const grammars = new SpeechGrammarList()
      grammars.addFromString(targetGrammar, 1)
      this.recognition.grammars = grammars
    }

    this.recognition.addEventListener('error', (e) => {
      console.log('> recognition failed', e)
      this.updateStatus('confused')
    })

    this.recognition.addEventListener('nomatch', (e) => {
      console.log('> no match')
      this.updateStatus('confused')
    })

    this.recognition.addEventListener('audiostart', () => {
      this.updateStatus('listening')
    })

    this.recognition.addEventListener('result', (e) => {
      this.updateStatus('thinking')

      this.onVoiceResult([...e.results]).then((status) => {
        if (!status) {
          this.updateStatus('confused')
        }
      })
    })

    this.recognition.addEventListener('end', (e) => {
      this.updateStatus('disabled')
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
      },
    })
  }

  async onVoiceResult(results: SpeechRecognitionResult[]): Promise<boolean> {
    console.log(`[results]`, results)

    const params = getVoicePromptParams()
    console.log(`[params]`, params)

    for (const i in results) {
      const voiceResult = results[i]

      const alts = [...voiceResult]
        .filter((b) => b.confidence > 0.000001)
        .sort((a, b) => b.confidence - a.confidence)
        .map((alt) => alt.transcript)

      if (alts.length === 0) {
        continue
      }

      console.log(`[heard] ${alts.join(', ')}`)

      // PASS 1 - use speech recognition grammar
      for (const alt of alts) {
        if (alt === 'back') {
          prevStep()
          return true
        }

        if (['x', 'y', 'z', 'why'].includes(alt.toLowerCase())) {
          handleVoiceSelection(alt.toLowerCase(), 'choice')
          return true
        }

        const primaryOk = handleVoiceSelection(alt, 'any')
        if (primaryOk) {
          console.log(`${alt} is detected by voice engine`)
          return true
        }
      }

      // PASS 2 - use GPT
      const alt = alts?.[0]?.trim()
      const msg = JSON.stringify({ input: alt, ...params })
      const aiOutput = await gpt(CORRECTION_PROMPT, msg)
      console.log(`[ai]`, aiOutput)

      let obj = { choice: null } as {
        choice: string | null
        percent: string | null
      }

      try {
        obj = JSON.parse(aiOutput)
      } catch (err) {}

      if (obj.percent) {
        return handleVoiceSelection(obj.percent, 'percent')
      }

      if (obj.choice) {
        return handleVoiceSelection(obj.choice, 'choice')
      }
    }

    return false
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
