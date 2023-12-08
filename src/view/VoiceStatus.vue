<template>
  <div
    fixed
    left-8
    bottom-8
    text-9
    font-medium
    :class="[
      {
        'text-red': status === 'disabled' || !understand,
        'text-purple': status === 'listening',
        'text-blue': status === 'speaking' || status === 'thinking',
      },
      'font-[Inter]',
    ]"
  >
    <div v-if="transcript">you: {{ transcript }}</div>

    <div v-if="status === 'disabled'">not listening</div>
    <div v-if="status === 'listening'">listening to you</div>
    <div v-if="status === 'speaking'">speaking</div>
    <div v-if="status === 'thinking'">thinking...</div>

    <div
      v-if="botMessage || isStringResult"
      :class="{ 'text-purple': understand && !botError, 'text-red': botError }"
    >
      AI: {{ botMessage || gptResult }}
    </div>

    <div
      v-if="gptResult.length > 0 && !botMessage"
      class="text-6 pt-2"
      :class="{
        'text-purple': understand,
        'text-red': !understand || botError,
      }"
    >
      <code class="font-[Zed_Mono_Extended]">AI: {{ gptResult }} </code>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'
import {
  $gptResult,
  $status,
  $transcript,
  $understand,
  $result,
} from '../store/status'

const status = useStore($status)
const transcript = useStore($transcript)
const gptResult = useStore($gptResult)
const understand = useStore($understand)
const result = useStore($result)

const botMessage = computed(() => result.value?.message?.slice(0, 100) ?? '')
const botError = computed(() => result.value?.error ?? false)
const isStringResult = computed(() => result)
</script>
