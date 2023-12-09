<script lang="ts" setup>
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import { choices, Choice, ChoiceKey } from '../step-input'

import {
  $selectedChoice,
  $selectedChoiceKey,
  $currentStep,
  setChoice,
  clearMainChoice,
  prevStep,
  addValue,
  $selectedValues,
  $valueCompleted,
} from '../store/choice.ts'

import {
  $gptResult,
  $result,
  $status,
  $transcript,
  $understand,
} from '../store/status.ts'

const selectedChoiceKey = useStore($selectedChoiceKey)
const selectedChoice = useStore($selectedChoice)
const currentStep = useStore($currentStep)
const selectedStepChoices = useStore($selectedValues)
const completed = useStore($valueCompleted)

const status = useStore($status)
const transcript = useStore($transcript)
const result = useStore($result)

const isListening = computed(() => status.value === 'listening')
const isOffline = computed(() => status.value === 'offline')

const selectedStepChoiceTitles = computed(() => {
  const steps = selectedChoice.value?.steps
  if (!steps) return []

  return selectedStepChoices.value.map((key, index) => {
    const step = steps[index]
    if (!step) return key

    if (step.type === 'choice') {
      return step.choices.find((c) => c.key === key)?.title ?? key
    }

    return key
  })
})
</script>

<template>
  <div
    class="fixed top-10 left-10 flex items-start justify-start gap-x-6 text-5 font-zed w-full"
  >
    <div
      class="min-w-10 min-h-10 bg-gray-9"
      :class="[{ 'bg-red-6': isListening }]"
    />

    <div />
    <div
      flex
      v-if="completed"
      class="cursor-pointer py-1 px-2 rounded"
      :class="[{ 'bg-red-7 text-white': completed }]"
    >
      > executing
    </div>
    <div flex flex-col v-if="!selectedChoiceKey">
      <div
        :class="[
          {
            'bg-gray-9 text-white': selectedChoiceKey === key,
          },
        ]"
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
        v-for="(choice, key) in choices"
        @click="setChoice(key)"
      >
        > {{ choice.title }}
      </div>
    </div>
    <div
      flex
      flex-col
      cursor-pointer
      class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
      :class="[{ '!bg-gray-8 text-white': completed }]"
      v-if="selectedChoiceKey"
      @click="clearMainChoice()"
    >
      > {{ choices[selectedChoiceKey]?.title }}
    </div>
    <div
      v-for="choice in selectedStepChoiceTitles"
      class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
      :class="[{ '!bg-gray-8 text-white': completed }]"
    >
      > {{ choice }}
    </div>
    <div flex flex-col v-if="currentStep?.type === 'choice' && !completed">
      <div
        :class="[{ 'bg-gray-9 text-white': false }]"
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
        v-for="choice in currentStep.choices"
        @click="addValue(choice.key)"
      >
        > {{ choice.title }}
      </div>
      <div
        :class="[{ 'bg-gray-9 text-white': false }]"
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
        @click="prevStep()"
      >
        > back
      </div>
    </div>
    <div flex flex-col v-if="currentStep?.type === 'percent' && !completed">
      <div py-1 px-2 @click="addValue('50')">
        > say a percentage (0% - 100%)
      </div>
      <div
        :class="[{ 'bg-gray-9 text-white': false }]"
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded"
        @click="prevStep()"
      >
        > back
      </div>
    </div>
  </div>
</template>
