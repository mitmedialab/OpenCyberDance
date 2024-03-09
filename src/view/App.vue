<script lang="ts" setup>
import { ref, onMounted, ReactiveFlags } from 'vue'
import { useStore } from '@nanostores/vue'

import {
  $showPrompt,
  $valueCompleted,
  extendPromptTimeout,
  clearPromptTimeout,
  resetPrompt,
} from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'
import { ding, soundManager } from '../ding.ts'
import StageControl from './StageControl.vue'

import { EndingKeyframes } from '../character'
import { $currentScene } from '../store/scene'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
// const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  await world.preload()
  await world.setup()

  window.addEventListener('keydown', async (event) => {
    if (event.key === ' ' || event.key === 'PageDown') {
      if (world.isEnding && world.flags.waitingEndingStart) {
        return
      }

      const willVisible = !showPrompt.value

      const completed = $valueCompleted.get()

      if (completed) {
        soundManager.play()
        world.voice.enableVoice('prompt completed')
        resetPrompt()
        $showPrompt.set(true)

        return
      }

      resetPrompt()

      if (willVisible) {
        soundManager.play()
        world.voice.enableVoice('prompt activated')
        $showPrompt.set(true)

        // start the prompt timeout countdown
        extendPromptTimeout('prompt activated', true)
      } else {
        world.voice.stop()
        $showPrompt.set(false)

        clearPromptTimeout('prompt deactivated')
      }
    }

    // if (event.key === 'i') {
    //   if (world.panel.panel._hidden) {
    //     world.panel.panel.show(true)
    //   } else {
    //     world.panel.panel.hide()
    //   }
    // }

    // if (event.key === 'c') {
    //   world.setupControls()
    // }

    // if (event.key === 'k') {
    //   const cam = world.camera
    //   if (!cam) return

    //   const output = JSON.stringify({
    //     position: cam.position.toArray(),
    //     rotation: cam.rotation.toArray(),
    //     zoom: cam.zoom,
    //   })

    //   navigator.clipboard.writeText(output)
    // }

    if ((event.key === 'e' || event.key === 'ำ') && event.ctrlKey) {
      if (world.flags.waitingEndingStart) {
        world.fadeInSceneContent()

        world.flags.waitingEndingStart = false
        return
      }

      if (world.isEnding) return $currentScene.set('BLACK')

      $currentScene.set('ENDING')
    }

    if ((event.key === 'u' || event.key === 'ี') && event.ctrlKey) {
      world.startShadowCharacter()
    }

    if ((event.key === 'i' || event.key === 'ร') && event.ctrlKey) {
      world.startDissolveCharacter()
    }

    if (event.key === 'f' && event.ctrlKey) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }

    if (event.key === 'j' && event.ctrlKey) {
      const k = [...world.voice.unfinalPercentCache.keys()]

      console.log('OPERATION J', k)
    }
  })

  rendererElement.value?.appendChild(world.renderer.domElement)

  // if (world.plotter.domElement) {
  //   plotterContainer.value?.appendChild(world.plotter.domElement)
  // }

  world.render()
})
</script>

<template>
  <div class="app-container">
    <div class="backdrop" />
    <div class="renderer-container" ref="rendererElement" />

    <!-- <div ref="plotterContainer" pointer-events-none /> -->

    <StepPrompt v-if="showPrompt" />
    <StageControl />
  </div>
</template>
