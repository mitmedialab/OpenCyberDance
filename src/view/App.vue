<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useStore } from '@nanostores/vue'

import { $showPrompt, $valueCompleted, resetPrompt } from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'
import { ding } from '../ding.ts'
import MusicControl from './MusicControl.vue'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  await world.setup()

  window.addEventListener('keydown', async (event) => {
    if (event.key === ' ') {
      const next = !showPrompt.value

      world.voice.enableVoice('prompt activate')

      const completed = $valueCompleted.get()

      if (completed) {
        ding()
        resetPrompt()

        return
      }

      resetPrompt()
      $showPrompt.set(next)

      if (next) {
        ding()
      } else {
        world.voice.stop()
      }
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

    <MusicControl />
  </div>
</template>
