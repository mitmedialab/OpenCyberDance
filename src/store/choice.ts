import { produce } from 'immer'
import { atom, computed } from 'nanostores'

import { runCommand } from '../command.ts'
import { Choice, ChoiceKey, choices } from '../step-input.ts'
import { world } from '../world.ts'
import { $status } from './status.ts'

export const $selectedChoiceKey = atom<ChoiceKey | null>(null)
export const $currentStepId = atom<number | null>(0)
export const $selectedValues = atom<string[]>([])

export const $showPrompt = atom(false)

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

    return steps[currentStepId]
  },
)

export const $valueCompleted = computed(
  [$currentStepId, $selectedChoice],
  (step, selectedChoice) => isValueCompleted(step, selectedChoice),
)

export function isValueCompleted(step: number | null, choice: Choice | null) {
  if (step === null || !choice) return false
  if (choice.steps.length === 0) return true

  return step - 1 === choice.steps.length - 1
}

export function nextStep() {
  const step = $currentStepId.get() || 0

  $currentStepId.set(step + 1)
}

export function prevStep() {
  const currentStep = $currentStep.get()
  const step = $currentStepId.get() || 0
  console.log('prev step', { currentStep, step })

  clearStepChoice()

  if (!currentStep || step === 0) {
    console.log('resetting main choice', { currentStep, step })
    $currentStepId.set(0)
    clearMainChoice()
    return
  }

  $currentStepId.set(Math.max(step - 1, 0))
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
}

export function clearStepChoice() {
  const result = produce($selectedValues.get(), (choices) => {
    choices.pop()
  })

  $selectedValues.set(result)
}

export function addValue(key: string) {
  $selectedValues.set([...$selectedValues.get(), key])
  nextStep()

  const completed = $valueCompleted.get()
  if (!completed) return

  world.voice.stop()
  runCommand($selectedChoiceKey.get()!, $selectedValues.get())

  setTimeout(() => {
    console.log('-- clearing prompt')

    resetPrompt()
    $showPrompt.set(false)
  }, 3000)
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

export function handleVoiceSelection(
  input: string | number,
  type?: 'choice' | 'percent' | 'any',
): boolean {
  const selectedChoiceKey = $selectedChoiceKey.get()
  const currentStep = $currentStep.get()

  if (!selectedChoiceKey || !currentStep) {
    if (choicesKey.includes(input)) {
      console.log('--- select')
      setChoice(input as ChoiceKey)

      return true
    }
  }

  if (!currentStep) return false
  if (!input) return false
  if (input === null || input === undefined) return false

  if (typeof input === 'string' && input.includes('back')) {
    prevStep()
    return true
  }

  if (currentStep.type === 'choice') {
    if (typeof input === 'number') return false

    const title = input.toLowerCase()

    const choice = currentStep.choices.find(
      (x) => x.title.toLowerCase() === title,
    )

    if (choice) {
      addValue(choice.key)
      return true
    }

    if (title === 'why') {
      addValue('y')
      return true
    }
  }

  if (currentStep.type === 'percent') {
    if (typeof input === 'number') {
      addValue(`${input}`)
      return true
    }

    const percent = parseInt(input)

    if (isNaN(percent)) return false
    if (percent < 0) return false
    if (percent > 300) return false

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
    console.log('choice grammar:', choiceGrammar)

    return grammar
  }

  return null
}

export const $isNotListening = computed(
  [$showPrompt, $status],
  (show, status) => show && status === 'disabled',
)

$isNotListening.listen((value) => {
  if (value) {
    console.log('re-starting voice...')

    setTimeout(() => {
      world.voice.start()
    }, 50)
  }
})
