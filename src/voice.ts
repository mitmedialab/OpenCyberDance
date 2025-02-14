import { findMostFrequentNumber } from './number-parser.ts'
import { Step } from './step-input.ts'
import {
  $currentStep,
  $nonFinalNum,
  $showPrompt,
  $valueCompleted,
  createGrammarFromState,
  extendPromptTimeout,
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

  unfinalPercentCache: Map<number, number> = new Map()

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
      console.debug(`[status] ${status} (key=${key})`)
    }
  }

  setOpenAIKey(key: string) {
    if (!key) return

    localStorage.setItem('OPENAI_KEY', key)
  }

  enableVoice(key?: string) {
    console.debug(`[enable voice] ${key}`)
    this.startRecognition('start method')
  }

  startRecognition(key?: string) {
    try {
      this.recognition?.abort()
    } catch (error) {
      if (error instanceof Error) {
        console.debug('recognition failed to abort', error)
      }
    }

    this.successFlags.clear()

    this.createRecognition()

    if (!this.recognition) return

    try {
      this.recognition.start()
    } catch (error) {
      if (error instanceof Error) {
        console.debug('recognition failed to start', error)
      }
    }

    console.debug(`[recognition started] ${key}`)
  }

  stop(key?: string) {
    this.updateStatus('disabled')

    try {
      this.recognition?.abort()
    } catch (err) {}

    this.recognition = null

    console.debug(`[recognition stopped] ${key}`)
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
    this.recognition.lang = 'en-TH'
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

      $voiceError.set(null)
    })

    this.recognition.addEventListener('audiostart', () => {
      this.updateStatus('listening', 'audio start')
    })

    this.recognition.addEventListener('speechstart', () => {
      extendPromptTimeout('speech start')
    })

    this.recognition.addEventListener('result', async (e) => {
      const id = e.results.length

      extendPromptTimeout('speech result')

      if (this.successFlags.get(id)) {
        console.debug(`[!] ${id} already success. (v=1)`)
        return
      }

      this.updateStatus('thinking')
      this.restoreStatusTimer('thinking')

      // TODO: timer

      const status = await this.onVoiceResult(e.results)

      if (this.successFlags.get(id)) {
        console.debug(`[!] ${id} already success. (v=2)`)
        return
      }

      if (status) {
        console.debug(`> interpretation success (id: ${id})`)
        this.successFlags.set(id, true)

        return
      }

      console.debug(`> cannot interpret result (id: ${id})`)

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
        resolve()
        return
      }

      this.updateStatus('speaking')
      console.debug(`> [speaking] ${text}`)

      // don't speak too much.
      let spokenText = text.slice(0, 150)

      if (spokenText.includes('rotations x')) {
        spokenText = spokenText.replace('rotations x', 'rotations ex')
      }

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

    // const params = getVoicePromptParams()

    const alts = [...voiceResult]
      .filter((b) => b.confidence > 0.000001)
      .sort((a, b) => b.confidence - a.confidence)
      .map((alt) => alt.transcript)

    if (isPercent) {
      const finalNumber = findMostFrequentNumber(alts)

      alts.unshift(finalNumber?.toString())
    }

    if (alts.length === 0) return false

    console.debug(
      `[heard] ${alts.join(', ')} (final=${isFinal}, id=${resultLen})`,
    )

    const isEmpty = alts.map((a) => a.trim()).every((a) => a === '')

    if (isEmpty && isPercent) {
      const cached = this.unfinalPercentCache.get(resultLen)
      console.warn(`empty result for percent ~ id ${resultLen}`)

      if (typeof cached === 'number') {
        handleVoiceSelection(cached)
        this.unfinalPercentCache.clear()

        return true
      }
    }

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
        const id = resultLen
        console.info(`[vh:skip id=${id}] percent not final`, alts)

        for (const alt of alts) {
          const n = parseInt(alt)

          if (!isNaN(n)) {
            console.log(`cached ${n} for id ${id}`)
            $nonFinalNum.set(n)
            this.unfinalPercentCache.set(id, n)
            break
          }

          if (isNaN(n)) {
            if (/zero/.test(alt)) {
              $nonFinalNum.set(0)
              break
            }
          }
        }

        return false
      }

      const primaryOk = handleVoiceSelection(alt)

      if (primaryOk) {
        console.debug(`${alt} is detected by voice engine; final=${isFinal}.`)
        return true
      }
    }

    console.warn(`cannot parse input: (${alts.join(', ')})`, step)

    return false
  }
}
