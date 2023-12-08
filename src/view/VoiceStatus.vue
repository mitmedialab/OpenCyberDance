<template>
  <div
    fixed
    left-8
    bottom-8
    text-9
    font-medium
    :class="[
      {
        'text-red': status === 'disabled',
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
  </div>
</template>

<script lang="ts" setup>
import { useStore } from '@nanostores/vue'
import { $gptResult, $status, $transcript } from '../store/status'

const status = useStore($status)
const transcript = useStore($transcript)
const gptResult = useStore($gptResult)
</script>
