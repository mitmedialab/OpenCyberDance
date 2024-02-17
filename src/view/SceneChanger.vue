<template>
  <div flex>
    <div
      class="py-1 cursor-pointer select-none"
      :class="[
        {
          'text-green-500 hover:text-green-600': isEnding,
          'text-gray-200 hover:text-green-300': !isEnding,
        },
      ]"
      @click="toggleEnding"
    >
      ED
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useStore } from '@nanostores/vue'

import { $currentScene } from '../store/scene'
import { computed } from 'vue'

const currentScene = useStore($currentScene)
const isEnding = computed(() => currentScene.value === 'ENDING')

function toggleEnding() {
  if (isEnding.value) return $currentScene.set('BLACK')

  $currentScene.set('ENDING')
}
</script>
