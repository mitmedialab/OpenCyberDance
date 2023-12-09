import { produce } from 'immer'
import { atom, computed } from 'nanostores'

import { runCommand } from '../command.ts'
import { Choice, ChoiceKey, choices } from '../step-input.ts'

export const $selectedChoiceKey = atom<ChoiceKey | null>(null)
export const $currentStepId = atom<number | null>(0)
export const $selectedValues = atom<string[]>([])

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

  runCommand($selectedChoiceKey.get()!, $selectedValues.get())

  setTimeout(() => {
    console.log('resetting!')
    $currentStepId.set(null)
    $selectedValues.set([])
    $selectedChoiceKey.set(null)
  }, 3000)
}

export const clearMainChoice = () => {
  $selectedChoiceKey.set(null)
}
