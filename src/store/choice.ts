import {atom, computed} from 'nanostores'
import {ChoiceKey, choices} from "../step-input.ts";
import {produce} from "immer";

export const $selectedChoiceKey = atom<ChoiceKey | null>(null)
export const $currentStepId = atom<number | null>(0)
export const $selectedValues = atom<string[]>([])

export const $selectedChoice = computed($selectedChoiceKey, (selectedChoiceKey) => {
  if (!selectedChoiceKey) return null

  return choices[selectedChoiceKey]
})

export const $currentStep = computed([$selectedChoice, $currentStepId], (selectedChoice, currentStepId) => {
  if (!selectedChoice || currentStepId === null) return null

  const steps = selectedChoice.steps
  if (steps.length === 0) return null

  return steps[currentStepId]
})

export const $valueCompleted = computed([$currentStepId, $selectedChoice], (step, selectedChoice) => {
  return selectedChoice && step === selectedChoice.steps.length - 1
})

export function nextStep() {
  const step = $currentStepId.get() || 0

  $currentStepId.set(step + 1)
}

export function prevStep() {
  const currentStep = $currentStep.get()
  const step = $currentStepId.get() || 0
  console.log('prev step', {currentStep, step})

  clearStepChoice()

  if (!currentStep || step === 0) {
    console.log('resetting main choice', {currentStep, step})
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
}

export function clearStepChoice() {
  const result = produce($selectedValues.get(), choices => {
    choices.pop()
  })

  $selectedValues.set(result)
}

export function addValue(key: string) {
  $selectedValues.set([...$selectedValues.get(), key])

  if ($valueCompleted.get()) {
    console.log('we are done!')
    return
  }

  nextStep()
}

export const clearMainChoice = () => {
  $selectedChoiceKey.set(null)
}
