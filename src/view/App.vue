<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { useStore } from '@nanostores/vue'
import { useMagicKeys } from '@vueuse/core'

import { $showPrompt, resetPrompt } from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  await world.setup()

  window.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
      resetPrompt()
      $showPrompt.set(!showPrompt.value)
      world.voice.start()
    }

    if (event.key === 'i') {
      if (world.panel.panel._hidden) {
        world.panel.panel.show(true)
      } else {
        world.panel.panel.hide()
      }
    }
  })

  rendererElement.value?.appendChild(world.renderer.domElement)

  if (world.plotter.domElement) {
    plotterContainer.value?.appendChild(world.plotter.domElement)
  }

  world.render()
})
</script>

<template>
  <div>
    <div ref="rendererElement" />
    <div ref="plotterContainer" pointer-events-none />

    <StepPrompt v-if="showPrompt" />
  </div>
</template>
