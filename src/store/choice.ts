import { produce } from 'immer'
import { atom, computed } from 'nanostores'

import { runCommand } from '../command'
import { Choice, ChoiceKey, choices, Step } from '../step-input'
import { world } from '../world'

const PROMPT_TIMEOUT = 1000 * 30

export const $selectedChoiceKey = atom<ChoiceKey | null>(null)
export const $currentStepId = atom<number | null>(0)
export const $selectedValues = atom<string[]>([])

export const $showPrompt = atom(false)
export const $promptTimer = atom<number | null>(null)

export const $selectedChoice = computed(
  $selectedChoiceKey,
  (selectedChoiceKey) => {
    if (!selectedChoiceKey) return null

    return choices[selectedChoiceKey]
  },
)

export const $currentStep = computed(
  [$selectedChoice, $currentStepId],
  (selectedChoice, currentStepId) => {
    if (!selectedChoice || currentStepId === null) return null

    const steps = selectedChoice.steps
    if (steps.length === 0) return null

    console.log(`current step is ${currentStepId}:`, steps[currentStepId])

    return steps[currentStepId]
  },
)

export const $valueCompleted = computed(
  [$currentStepId, $selectedChoice, $selectedValues],
  (step, selectedChoice, values) =>
    isValueCompleted(step, selectedChoice, values),
)

export function isValueCompleted(
  step: number | null,
  choice: Choice | null,
  values?: string[],
) {
  if (step === null || !choice) return false
  if (choice.steps.length === 0) return true

  if (values?.includes('reset')) return true

  return step - 1 === choice.steps.length - 1
}

export function nextStep() {
  const step = $currentStepId.get() || 0
  const next = step + 1

  $currentStepId.set(next)

  extendPromptTimeout('prompt next')
}

export function prevStep() {
  const currentStep = $currentStep.get()
  const step = $currentStepId.get() || 0

  clearStepChoice()

  if (!currentStep || step === 0) {
    $currentStepId.set(0)
    clearMainChoice()
    return
  }

  $currentStepId.set(Math.max(step - 1, 0))

  extendPromptTimeout('prompt prev')
}

export function setChoice(choice: ChoiceKey) {
  $selectedChoiceKey.set(choice)

  $currentStepId.set(0)
  $selectedValues.set([])

  if (choices[choice]?.steps.length === 0) {
    runCommand(choice, [])
    $selectedChoiceKey.set(null)
    $showPrompt.set(false)
  }

  extendPromptTimeout(`set choice ${choice}`)
}

export function clearStepChoice() {
  const result = produce($selectedValues.get(), (choices) => {
    choices.pop()
  })

  $selectedValues.set(result)
}

export function addValue(key: string) {
  console.log(`> added value: ${key}`)

  $selectedValues.set([...$selectedValues.get(), key])

  // for reset, we should not ask for percentage.
  if (key === 'reset') {
    runCommand($selectedChoiceKey.get()!, $selectedValues.get())
    return
  }

  nextStep()

  const completed = $valueCompleted.get()
  if (!completed) return

  runCommand($selectedChoiceKey.get()!, $selectedValues.get())
}

export function resetPrompt() {
  $currentStepId.set(null)
  $selectedValues.set([])
  $selectedChoiceKey.set(null)
}

export const clearMainChoice = () => {
  $selectedChoiceKey.set(null)
}

const choicesKey = Object.keys(choices)

const selectChoice = (choice: ChoiceKey) => {
  setChoice(choice)
  // ding(2)
  return true
}

export function handleVoiceSelection(input: string | number): boolean {
  extendPromptTimeout(`handle voice ${input}`)

  const selectedChoiceKey = $selectedChoiceKey.get()
  const currentStep = $currentStep.get() as Step

  if (!selectedChoiceKey || !currentStep) {
    if (choicesKey.includes(input as string)) {
      return selectChoice(input as ChoiceKey)
    }

    if (/(energy|allergy)/i.test(input as string)) {
      return selectChoice('energy')
    }

    if (
      /(location|rotate|rotation|rotations|quotation)/i.test(input as string)
    ) {
      return selectChoice('rotations')
    }

    if (/(space|external|body)/i.test(input as string)) {
      return selectChoice('space')
    }

    if (/(curve|curse|circle|circle and curve)/i.test(input as string)) {
      return selectChoice('curve')
    }

    if (/(relation|shifting|shooting)/i.test(input as string)) {
      return selectChoice('shifting')
    }

    if (/(speed|animation|dance speed|dancer speed)/i.test(input as string)) {
      return selectChoice('speed')
    }

    if (
      !world.isEnding &&
      /(dancer|dancers|character|model)/i.test(input as string)
    ) {
      return selectChoice('dances')
    }
  }

  if (!currentStep) return false
  if (input === '' || input === null || input === undefined) return false

  if (typeof input === 'string' && /back|go back|previous/i.test(input)) {
    prevStep()
    return true
  }

  if (currentStep.type === 'choice') {
    if (typeof input === 'number') return false

    const title = input.toLowerCase().trim()
    const isOrdered = currentStep.meta === 'ordered'

    const choice = currentStep.choices.find((x) => {
      if (isOrdered) {
        return x.title.replace(/^\d+\.\s*/, '') === title
      }

      return x.title.toLowerCase() === title
    })

    const opts = currentStep.choices.map((c) => c.key)

    if (isOrdered) {
      const order = parseInt(title)

      if (!isNaN(order)) {
        const key = currentStep.choices[order - 1].key
        addValue(key)

        return true
      }
    }

    if (choice) {
      addValue(choice.key)
      return true
    }

    const fix = (key: string, match: RegExp): boolean => {
      const matched = opts.includes(key) && match.test(title)
      if (matched) addValue(key)

      return matched
    }

    // auto-corrections
    if (fix('left', /^(left|left limb)/i)) return true
    if (fix('right', /^(right|right limb|rylim|ride lim|light)/i)) return true
    if (fix('upper', /^(up|upper|up per|up her|at her)/i)) return true
    if (fix('lower', /^(low|lower)/i)) return true
    if (fix('leftArm', /(left on)/i)) return true
    if (fix('rightArm', /(light arm|right now|light now)/i)) return true
    if (fix('rightLeg', /(light lake|right lake|bright lake)/i)) return true
    if (fix('gaussian', /(gauss|klaus)/i)) return true
    if (fix('all', /(all|oh)/i)) return true
    if (fix('x', /^(ex)$/i)) return true
    if (fix('y', /^(why|wine|whine)$/i)) return true
    if (fix('z', /^(see|sea)$/i)) return true
    if (fix('kukpat', /^(tus|tusk|task|tas)/i)) return true
    if (fix('yokroblingImprovise', /^(monkey|rob monkey)$/i)) return true
    if (fix('number60', /^(number|six|sixty|number sixty)/i)) return true
  }

  if (currentStep.type === 'percent') {
    console.log('[percent parse]', input)

    if (typeof input === 'number') {
      addValue(`${input}`)
      return true
    }

    const percent = parseInt(input)

    const fixNum = (num: string, match: RegExp): boolean => {
      if (match.test(input)) {
        addValue(num)
        return true
      }

      return false
    }

    if (isNaN(percent)) {
      if (fixNum('0', /^(zero|ciro)$/i)) return true
      if (fixNum('100', /^(one hundred)$/i)) return true
      if (fixNum('200', /^(two hundred)$/i)) return true
      if (fixNum('300', /^(three hundred)$/i)) return true
      if (fixNum('1', /^(one)$/i)) return true
      if (fixNum('2', /^(two)$/i)) return true
      if (fixNum('3', /^(three)$/i)) return true
      if (fixNum('4', /^(four|for)$/i)) return true
      if (fixNum('5', /^(five)$/i)) return true
      if (fixNum('6', /^(six)$/i)) return true
      if (fixNum('7', /^(seven)$/i)) return true
      if (fixNum('8', /^(eight)$/i)) return true
      if (fixNum('80', /^(8T)$/i)) return true
      if (fixNum('9', /^(nine)$/i)) return true
      if (fixNum('0', /^(zero)$/i)) return true

      return false
    }

    if (percent < 0) return false
    if (percent > Math.max(currentStep.max ?? 100, 100)) return false

    addValue(`${percent}`)
    return true
  }

  return false
}

export function getVoicePromptParams():
  | { percent: true }
  | { choices: string[] } {
  const selectedChoiceKey = $selectedChoiceKey.get()
  const choiceKeys = Object.keys(choices)

  if (!selectedChoiceKey) return { choices: choiceKeys }

  const currentStep = $currentStep.get()
  if (!currentStep) return { choices: choiceKeys }

  if (currentStep.type === 'choice') {
    return { choices: currentStep.choices.map((x) => x.title) }
  }

  if (currentStep.type === 'percent') {
    return { percent: true }
  }

  return { percent: true }
}

export function createGrammarFromState(): string | null {
  const params = getVoicePromptParams()

  const hasChoice = 'choices' in params

  let grammar = `
    #JSGF V1.0;
    
    grammar choices;
  `

  if (hasChoice) {
    const choiceGrammar = `public <choice> = ${
      params.choices?.join(' | ') || ''
    };`

    grammar += choiceGrammar

    return grammar
  }

  return null
}

export function clearPromptTimeout(reason?: string) {
  const timer = $promptTimer.get()
  if (timer !== null) clearTimeout(timer)

  console.debug(`clearing prompt (t = ${timer}, r = "${reason}")`)

  $promptTimer.set(null)

  return timer
}

export function extendPromptTimeout(reason?: string, always = false) {
  const timer = $promptTimer.get()
  if (timer === null && !always) return

  console.debug(`extending prompt (t = ${timer}, r = "${reason}")`)

  // clear existing timer
  clearPromptTimeout('to extend')

  const nextTimer = setTimeout(() => {
    console.log(`prompt timed out:`, $promptTimer.get())

    $showPrompt.set(false)
    world.voice.stop()

    clearPromptTimeout('timed out')
  }, PROMPT_TIMEOUT)

  $promptTimer.set(nextTimer)
}
