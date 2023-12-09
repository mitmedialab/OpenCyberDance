<script lang="ts" setup>
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import { choices } from '../step-input'

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

import { $result, $status, $transcript, $voiceError } from '../store/status.ts'

const selectedChoiceKey = useStore($selectedChoiceKey)
const selectedChoice = useStore($selectedChoice)
const currentStep = useStore($currentStep)
const selectedStepChoices = useStore($selectedValues)
const completed = useStore($valueCompleted)

const status = useStore($status)
const transcript = useStore($transcript)
const result = useStore($result)
const voiceError = useStore($voiceError)

const isListening = computed(() => status.value === 'listening')
const isThinking = computed(() => status.value === 'thinking')
const isOffline = computed(() => status.value === 'disabled')
const isConfused = computed(() => status.value === 'confused')

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

const numeric = (value: string) => {
  const num = Number(value)

  return !isNaN(num) && num >= 0 && num <= 200
}
</script>

<template>
  <div
    class="fixed top-10 left-10 flex items-start justify-start gap-x-6 text-5 font-zed animate__animated animate__fadeInUp"
    :class="{ 'bg-black text-white rounded animate__fadeInUp': completed }"
  >
    <div
      class="min-w-10 min-h-10 shadow shadow-2xl relative z-2 flex items-center justify-center animate__animated"
      :class="[
        {
          'animate__headShake animate__infinite': isConfused,
          'animate__rotateIn animate__infinite': isThinking,
          'bg-black': !isListening,
          'bg-red-7 animate__flash animate__infinite': isListening,
        },
      ]"
      v-if="!completed"
    />

    <div
      flex
      v-if="completed"
      class="cursor-pointer py-1 px-2 animate__animated fadeIn"
      :class="[{ 'bg-red-7 text-white px-4 rounded-l pl-4 pr-4': completed }]"
    >
      > executed
    </div>

    <div flex flex-col v-if="!selectedChoiceKey">
      <div
        :class="[
          {
            'bg-gray-9 text-white': selectedChoiceKey == key,
          },
        ]"
        class="hover:bg-gray-9 hover:text-white hover:rounded cursor-pointer py-1 px-2 animate__animated animate__fadeInUp"
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
      class="hover:bg-gray-9 hover:text-white hover:rounded cursor-pointer py-1 px-2 animate__animated animate__fadeInUp"
      v-if="selectedChoiceKey"
      @click="clearMainChoice()"
    >
      > {{ choices[selectedChoiceKey]?.title }}
    </div>

    <div
      v-for="choice in selectedStepChoiceTitles"
      class="hover:bg-gray-9 hover:text-white hover:rounded cursor-pointer py-1 px-2 last:pr-4 animate__animated animate__fadeInUp"
    >
      <span v-if="numeric(choice)">> {{ choice }}%</span>
      <span v-else>> {{ choice }}</span>
    </div>

    <div flex flex-col v-if="currentStep?.type === 'choice' && !completed">
      <div
        class="hover:bg-gray-9 hover:text-white hover:rounded cursor-pointer py-1 px-2 animate__animated animate__fadeInUp"
        v-for="choice in currentStep.choices"
        @click="addValue(choice.key)"
      >
        > {{ choice.title }}
      </div>

      <div
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 animate__animated animate__fadeInUp"
        @click="prevStep()"
      >
        &lt; back
      </div>
    </div>

    <div flex flex-col v-if="currentStep?.type === 'percent' && !completed">
      <div
        py-1
        px-2
        @click="addValue('50')"
        class="animate__animated animate__fadeInUp"
      >
        > percent (0% - 100%)
      </div>

      <div
        class="hover:bg-gray-9 hover:text-white cursor-pointer py-1 px-2 rounded animate__animated animate__fadeInUp"
        @click="prevStep()"
      >
        &lt; back
      </div>
    </div>
  </div>

  <div fixed bottom-4 left-4 class="text-[12px] font-zed text-gray-7">
    <div v-if="status">s: {{ status }}</div>
    <div v-if="transcript">h: {{ transcript }}</div>

    <div v-if="voiceError">
      e: {{ voiceError.error }} {{ voiceError.message }}
    </div>
  </div>
</template>
