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

const LANG = 'en-US'

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

  /** GC workaround */
  utterances: SpeechSynthesisUtterance[] = []

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
    speechSynthesis.cancel()
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

  async startRecognition(key?: string) {
    const ok = await this.setupLocalSpeech()
    if (!ok) return

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

  updatePhrases() {
    const targetPhrases = createGrammarFromState()

    console.log('[phrases]', { targetPhrases })

    if (targetPhrases && this.recognition) {
      const phrases = [
        ...targetPhrases.map(
          // @ts-expect-error -- outdated
          (word) => new SpeechRecognitionPhrase(word, 1.0),
        ),
      ]

      console.log('[phrases] applied', { phrases })

      // @ts-expect-error -- outdated
      this.recognition.phrases = phrases
    }
  }

  createRecognition() {
    this.recognition = new SpeechRecognition()
    this.recognition.lang = 'en-US'
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 8
    this.recognition.continuous = true

    // @ts-expect-error -- outdated type doc
    this.recognition.processLocally = true

    this.updatePhrases()

    // if (targetGrammar) {
    //   // const grammars = new SpeechGrammarList()
    //   // grammars.addFromString(targetGrammar, 1)
    //   // this.recognition.grammars = grammars
    // }

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

      console.log('--- result', e.results)

      extendPromptTimeout('speech result')

      // if (this.successFlags.get(id)) {
      //   console.debug(`[!] ${id} already success. (v=1)`)
      //   return
      // }

      this.updateStatus('thinking')
      this.restoreStatusTimer('thinking')

      // TODO: timer

      const status = await this.onVoiceResult(e.results)

      // if (this.successFlags.get(id)) {
      //   console.debug(`[!] ${id} already success. (v=2)`)
      //   return
      // }

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
      } else if (completed) {
        this.stop('recognition ended with status=completed')
        console.log('--- VoiceController :: STOPPED LISTENING! ---', {
          show,
          completed,
        })
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

    // if the status is already disabled, do not continue listening.
    if (this.status === 'disabled') {
      return
    }

    // if it's still not completed, then we need to continue!
    setTimeout(() => {
      if (!this.recognition) {
        this.startRecognition(key)
      }
    }, 100)
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.updateStatus('speaking')
      console.debug(`> [speaking] ${text}`)

      // don't speak too much.
      let spokenText = text.slice(0, 150)

      if (spokenText.includes('rotations x')) {
        spokenText = spokenText.replace('rotations x', 'rotations ex')
      }

      if (spokenText.includes('kukpat')) {
        spokenText = spokenText.replace('kukpat', 'kookpat')
      }

      if (spokenText.includes('o')) {
        spokenText = spokenText.replace('o', 'oh')
      }

      if (spokenText.includes('sunon')) {
        spokenText = spokenText.replace('sunon', 'soo-non')
      }

      speechSynthesis.cancel()

      const voice = speechSynthesis
        .getVoices()
        .find((v) => v.name.includes('Daniel'))

      // auto-resolve after 10 seconds
      const timer = setTimeout(() => {
        speechSynthesis.cancel()
        resolve()
      }, 15000)

      const u = new SpeechSynthesisUtterance(spokenText)
      u.lang = LANG
      u.voice = voice!
      u.rate = 1
      u.onend = () => {
        console.log(`[voice:onend] "${spokenText}"`)
        clearTimeout(timer)
        resolve()
      }
      u.onerror = (e) => {
        console.error(`[voice:onerror] "${spokenText}"`, e)
        clearTimeout(timer)
        resolve()
      }

      this.utterances.push(u)
      speechSynthesis.speak(u)
    })
  }

  async setupLocalSpeech() {
    try {
      // @ts-expect-error -- foo
      const checkStatus = await SpeechRecognition.available({
        langs: [LANG],
        processLocally: true,
      })

      if (checkStatus === 'available') {
        return true
      }

      console.log(`SpeechRecognition.available status: "${checkStatus}"`)

      if (checkStatus === 'unavailable') {
        return false
      }

      // @ts-expect-error -- bar
      const installStatus = await SpeechRecognition.install({
        langs: [LANG],
        processLocally: true,
      })

      console.log(`SpeechRecognition.install status: "${installStatus}"`)

      return installStatus
    } catch (error) {
      return false
    }
  }

  onVoiceResult(resultList: SpeechRecognitionResultList): boolean {
    const step = $currentStep.get() as Step
    const isPercent = step && step.type === 'percent'

    const resultLen = resultList.length
    const voiceResult = resultList[resultLen - 1]
    const isFinal = voiceResult.isFinal

    const alts = [...voiceResult]
      .filter((b) => b.confidence > 0.000001)
      .sort((a, b) => b.confidence - a.confidence)
      .map((alt) => alt.transcript)

    // prioritize the term "go back" otherwise integer "0" takes precedence
    for (const alt of alts) {
      if (/back|go back|previous/.test(alt)) {
        prevStep()
        return true
      }
    }

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
        console.log(`handleVoiceSelection(cached):`, cached)
        handleVoiceSelection(cached, false)
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
        console.log(`handleVoiceSelection(why):`, alt)
        handleVoiceSelection(alt.toLowerCase(), false)
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

      const primaryOk = handleVoiceSelection(alt, false)

      if (primaryOk) {
        console.log(
          `handleVoiceSelection(primaryOk=True, isFinal=${isFinal}):`,
          alt,
        )

        if (isFinal && alt.trim() === '0') {
          console.log('found 0, ignoring...')
          return false
        }

        console.log(`${alt} is detected by voice engine; final=${isFinal}.`)

        if ($valueCompleted.get()) {
          this.stop()
        }

        return true
      }
    }

    console.log(`[cannot parse input] (${alts.join(', ')})`, step)

    return false
  }
}
