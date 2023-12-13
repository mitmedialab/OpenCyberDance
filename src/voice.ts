import { getMaxOccurence, randVariance } from './math'
import { DelayPartKey } from './parts'
import { gpt } from './prompt'
import { CORRECTION_PROMPT } from './prompts.ts'
import { Step } from './step-input.ts'
import {
  $currentStep,
  $showPrompt,
  $valueCompleted,
  createGrammarFromState,
  getVoicePromptParams,
  handleVoiceSelection,
  prevStep,
} from './store/choice.ts'
import { $status, $transcript, $voiceError } from './store/status'
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
  | 'failed'

export class VoiceController {
  recognition: SpeechRecognition | null = null
  world: World

  /* Mapping between id (by recognition len) and success flag */
  successFlags: Map<number, boolean> = new Map()

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
  updateStatus(status: ListeningStatus, key?: string) {
    $status.set(status)

    if (key) {
      console.log(`[status] ${status} (key=${key})`)
    }
  }

  setOpenAIKey(key: string) {
    if (!key) return

    localStorage.setItem('OPENAI_KEY', key)
  }

  enableVoice(key?: string) {
    console.log(`[enable voice] ${key}`)
    this.startRecognition('start method')
  }

  startRecognition(key?: string) {
    try {
      this.recognition?.abort()
    } catch (error) {
      if (error instanceof Error) {
        console.log('recognition failed to abort', error)
      }
    }

    this.successFlags.clear()

    this.createRecognition()

    if (!this.recognition) return

    try {
      this.recognition.start()
    } catch (error) {
      if (error instanceof Error) {
        console.log('recognition failed to start', error)
      }
    }

    console.log(`[recognition started] ${key}`)
  }

  stop(key?: string) {
    this.updateStatus('disabled')

    try {
      this.recognition?.abort()
    } catch (err) {}

    this.recognition = null

    console.log(`[recognition stopped] ${key}`)
  }

  toggle() {
    if (this.status === 'disabled') {
      this.enableVoice('toggle')
      return
    }

    this.stop()
  }

  createRecognition() {
    this.recognition = new SpeechRecognition()
    this.recognition.lang = 'en-SG'
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 8
    this.recognition.continuous = true

    const targetGrammar = createGrammarFromState()

    if (targetGrammar) {
      const grammars = new SpeechGrammarList()
      grammars.addFromString(targetGrammar, 1)
      this.recognition.grammars = grammars
    }

    this.recognition.addEventListener('error', (e) => {
      // do not update error status if manually aborted by us.
      if (e.error === 'aborted') return

      // do not update error status if no speech detected.
      if (e.error === 'no-speech') return

      $voiceError.set(e)
      this.updateStatus('failed')

      console.warn('recognition failed:', e.error)

      setTimeout(() => {
        this.continueListening('restart after error')
      }, 1000)
    })

    this.recognition.addEventListener('nomatch', () => {
      this.onConfused()
    })

    this.recognition.addEventListener('start', () => {
      this.successFlags.clear()
      this.updateStatus('listening', 'recognizer start')
    })

    this.recognition.addEventListener('audiostart', () => {
      this.updateStatus('listening', 'audio start')
    })

    this.recognition.addEventListener('result', async (e) => {
      const id = e.results.length

      if (this.successFlags.get(id)) {
        console.log(`[!] ${id} already success. (v=1)`)
        return
      }

      this.updateStatus('thinking')
      this.restoreStatusTimer('thinking')

      // TODO: timer

      const status = await this.onVoiceResult(e.results)

      if (this.successFlags.get(id)) {
        console.log(`[!] ${id} already success. (v=2)`)
        return
      }

      if (status) {
        console.log(`> interpretation success (id: ${id})`)
        this.successFlags.set(id, true)

        return
      }

      console.log(`> cannot interpret result (id: ${id})`)

      this.onConfused()
    })

    this.recognition.addEventListener('end', () => {
      const completed = $valueCompleted.get()
      const show = $showPrompt.get()

      if (show && !completed) {
        this.continueListening('after recognition disconnected')
      }
    })
  }

  onConfused() {
    this.updateStatus('confused')
    this.restoreStatusTimer('confused')
  }

  restoreStatusTimer(status: ListeningStatus, delay = 800) {
    setTimeout(() => {
      if ($status.get() === status) {
        if (this.recognition) {
          this.updateStatus('listening', 'restore status timer')
        }
      }
    }, delay)
  }

  continueListening(key?: string) {
    const completed = $valueCompleted.get()

    // do not continue if already completed.
    if (completed) return

    // if it's still not completed, then we need to continue!
    setTimeout(() => {
      if (!this.recognition) {
        this.startRecognition(key)
      }
    }, 100)
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!responsiveVoice) {
        console.error('ResponsiveVoice not loaded!')
        return
      }

      this.updateStatus('speaking')
      console.log(`> [speaking] ${text}`)

      // don't speak too much.
      const spokenText = text.slice(0, 150)

      responsiveVoice.speak(spokenText, 'UK English Male', {
        rate: 1,
        onend: () => {
          resolve()
        },
      })
    })
  }

  async onVoiceResult(
    resultList: SpeechRecognitionResultList,
  ): Promise<boolean> {
    const step = $currentStep.get() as Step
    const isPercent = step && step.type === 'percent'

    const resultLen = resultList.length
    const voiceResult = resultList[resultLen - 1]
    const isFinal = voiceResult.isFinal

    const params = getVoicePromptParams()
    console.log(`[params]`, params)

    const alts = [...voiceResult]
      .filter((b) => b.confidence > 0.000001)
      .sort((a, b) => b.confidence - a.confidence)
      .map((alt) => alt.transcript)

    if (isPercent) {
      const definitelyNumbers = alts
        .map((s) => s.replace(/\D/g, ''))
        .filter((alt) => Number(alt))
        .filter(
          (alt) => step?.type === 'percent' && Number(alt) <= (step.max ?? 100),
        )

      const max = getMaxOccurence(definitelyNumbers)

      alts.unshift(max?.toString())
    }

    if (alts.length === 0) return false

    console.log(
      `[heard] ${alts.join(', ')} (final=${isFinal}, id=${resultLen})`,
    )

    $transcript.set(alts.join(', '))

    // PASS 1 - use speech recognition grammar
    for (const alt of alts) {
      if (/back|go back|previous/.test(alt)) {
        prevStep()
        return true
      }

      if (/^(ex|why|wine|see|sea)$/i.test(alt.toLowerCase())) {
        handleVoiceSelection(alt.toLowerCase())
        return true
      }

      // do not use voice engine to detect percentage if not final
      if (isPercent && !isFinal) {
        console.log('[vh:skip] percent not final', alts)
        return false
      }

      const primaryOk = handleVoiceSelection(alt)

      if (primaryOk) {
        console.log(`${alt} is detected by voice engine; final=${isFinal}.`)
        return true
      }
    }

    // only use GPT for final results
    if (!voiceResult.isFinal) {
      console.log(`[vc:skip:gpt] input not final`, alts)
      return false
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
      return handleVoiceSelection(obj.percent)
    }

    if (obj.choice) {
      return handleVoiceSelection(obj.choice)
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
