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

import {
  $result,
  $status,
  $transcript,
  $voiceError,
  $logs,
  $time,
  $duration,
} from '../store/status.ts'
import { world } from '../world'
import { $currentScene } from '../store/scene'

const selectedChoiceKey = useStore($selectedChoiceKey)
const selectedChoice = useStore($selectedChoice)
const currentStep = useStore($currentStep)

const currentScene = useStore($currentScene)

const selectedStepChoices = useStore($selectedValues)
const completed = useStore($valueCompleted)
const logs = useStore($logs)

const status = useStore($status)
const transcript = useStore($transcript)
const result = useStore($result)
const voiceError = useStore($voiceError)

const time = useStore($time)
const duration = useStore($duration)

const isListening = computed(() => status.value === 'listening')
const isThinking = computed(() => status.value === 'thinking')
const isOffline = computed(() => status.value === 'disabled')
const isConfused = computed(() => status.value === 'confused')

const isAnimationFinished = computed(() => time.value >= duration.value)

const selectedStepChoiceTitles = computed(() => {
  const steps = selectedChoice.value?.steps
  if (!steps) return []

  return selectedStepChoices.value.map((key, index) => {
    const step = steps[index]
    if (!step) return key

    if (step.type === 'choice') {
      const title = step.choices.find((c) => c.key === key)?.title
      if (!title) return key
      if (step.meta === 'ordered') return title.replace(/^\d+\.\s*/, '')

      return title
    }

    return key
  })
})

const numeric = (value: string, max = 300) => {
  const num = Number(value)

  return !isNaN(num) && num >= 0 && num <= max
}

const showPerc = (value: number): string | null => {
  if (isNaN(value)) return null

  return value.toFixed(0)
}

const currentPerc = computed(() => showPerc(currentStep.value?.current()))

const isEnding = computed(() => currentScene.value === 'ENDING')
</script>

<template>
  <div
    class="fixed top-10 left-10 prompt-root-container animate__animated animate__fadeInUp rounded-10"
  >
    <div class="fixed w-full h-full rounded-10 prompt-backdrop"></div>

    <div class="space-y-4 text-white prompt-root rounded-10">
      <div
        class="flex items-start justify-start gap-x-6 text-8 font-zed animate__animated"
        :class="{ 'text-white rounded': completed }"
      >
        <div
          class="min-w-14 min-h-14 shadow shadow-2xl relative z-2 flex items-center justify-center animate__animated"
          :class="[
            {
              'animate__rotateIn animate__infinite': isThinking,
              'bg-gray-800 dark:bg-white': !isListening && !voiceError,
              'bg-red-5 animate__flash animate__infinite': isListening,
              'bg-red-4 animate__heartBeat animate__infinite': !!voiceError,
              'animate__headShake animate__infinite': isConfused,
            },
          ]"
          v-if="!completed"
        />

        <div
          flex
          v-if="completed"
          class="cursor-pointer py-1 px-2 animate__animated fadeIn"
          :class="[
            {
              'bg-red-5 text-white px-4 rounded-l pl-4 pr-4': completed,
            },
          ]"
        >
          > executed
        </div>

        <div flex flex-col relative>
          <TransitionGroup name="choice-list">
            <div
              :class="[
                {
                  'highlight-a-bit-inverted dark:highlight-a-bit':
                    selectedChoiceKey == key,
                  'go-away': selectedChoiceKey && selectedChoiceKey != key,
                  animate__fadeInUp: !selectedChoiceKey,
                },
              ]"
              class="hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:rounded cursor-pointer py-1 px-2 animate__animated transition-faster"
              v-for="(choice, key) in choices"
              :key="key"
              v-show="
                (!selectedChoiceKey || selectedChoiceKey == key) &&
                !choice.hidden &&
                !(isEnding && key === 'dances')
              "
              @click="selectedChoiceKey ? clearMainChoice() : setChoice(key)"
            >
              > {{ choice.title }}
            </div>
          </TransitionGroup>
        </div>

        <div
          v-for="choice in selectedStepChoiceTitles"
          class="hover:bg-white hover:text-black hover:rounded cursor-pointer py-1 px-2 last:pr-4 animate__animated animate__fadeInUp"
          :key="choice"
          v-show="choice"
          :class="[{ 'highlight-a-bit': !completed }]"
        >
          <span v-if="numeric(choice, currentStep?.max)">> {{ choice }}%</span>
          <span v-else>> {{ choice }}</span>
        </div>

        <div flex flex-col v-if="currentStep?.type === 'choice' && !completed">
          <div
            class="hover:bg-white hover:text-black hover:rounded cursor-pointer py-1 px-2 animate__animated animate__fadeInUp transition-faster"
            v-for="choice in currentStep.choices"
            @click="addValue(choice.key)"
            :key="choice.key"
          >
            > {{ choice.title }}
          </div>

          <div
            class="hover:bg-white hover:text-black cursor-pointer py-1 px-2 animate__animated animate__fadeInUp transition-faster"
            @click="prevStep()"
          >
            &lt; go back
          </div>
        </div>

        <div flex flex-col v-if="currentStep?.type === 'percent' && !completed">
          <div
            py-1
            px-2
            @click="addValue('50')"
            class="animate__animated animate__fadeInUp"
          >
            <span
              >>
              <span v-if="currentPerc != null">{{ currentPerc }}% -> ?</span>
              (0% - {{ currentStep.max ?? 100 }}%)</span
            >
          </div>

          <div
            class="hover:bg-white hover:text-black cursor-pointer py-1 px-2 rounded animate__animated animate__fadeInUp transition-faster"
            @click="prevStep()"
          >
            &lt; go back
          </div>
        </div>
      </div>

      <div v-if="completed" class="flex flex-col font-zed gap-y-1">
        <TransitionGroup name="choice-list">
          <div
            v-for="(log, id) in logs.slice(0, 5)"
            :key="log"
            class="text-[14px] text-white animate__animated animate__fadeInUp transition-faster"
            v-show="id !== logs.length - 1"
          >
            $ {{ log }}
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>

  <div
    fixed
    bottom-4
    left-4
    class="text-[12px] font-zed space-y-1 dark:text-gray-200 text-white"
  >
    <div v-if="status" :class="[{ 'text-red-5': status === 'failed' }]">
      s: {{ status }}
    </div>

    <div v-if="transcript">h: {{ transcript }}</div>

    <div v-if="time">
      t: {{ time?.toFixed(2) }} / {{ duration?.toFixed(2) }}
    </div>

    <div v-if="voiceError" class="text-red-5">
      ve: {{ voiceError.error }} {{ voiceError.message }}
    </div>
  </div>
</template>
