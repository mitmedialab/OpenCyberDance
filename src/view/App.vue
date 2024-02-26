<script lang="ts" setup>
import { ref, onMounted, callWithAsyncErrorHandling } from 'vue'
import { useStore } from '@nanostores/vue'

import { $showPrompt, $valueCompleted, resetPrompt } from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'
import { ding } from '../ding.ts'
import MusicControl from './MusicControl.vue'

import { EndingKeyframes } from '../character'
import { $currentScene } from '../store/scene'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  await world.setup()

  window.addEventListener('keydown', async (event) => {
    if (event.key === ' ' || event.key === 'PageDown') {
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

    if (event.key === 'c') {
      world.setupControls()
    }

    if (event.key === 'k') {
      const cam = world.camera
      if (!cam) return

      const output = JSON.stringify({
        position: cam.position.toArray(),
        rotation: cam.rotation.toArray(),
        zoom: cam.zoom,
      })

      navigator.clipboard.writeText(output)
    }

    if (event.key === 'v') world.setTime(EndingKeyframes.SHADOW_APPEAR - 1)
    if (event.key === 'b') world.setTime(182)
    if (event.key === 'n') world.setTime(EndingKeyframes.SHADOW_EXITING - 1)

    if (event.key === 'e') {
      if (world.isEnding) return $currentScene.set('BLACK')

      $currentScene.set('ENDING')
    }

    if (event.key === 'f') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else if (document.exitFullscreen) {
        document.exitFullscreen()
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
  <div class="app-container">
    <div ref="rendererElement" />
    <div ref="plotterContainer" pointer-events-none />

    <StepPrompt v-if="showPrompt" />

    <MusicControl />
  </div>
</template>
