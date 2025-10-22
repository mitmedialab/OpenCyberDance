<script lang="ts" setup>
import { ref, onMounted, ReactiveFlags } from 'vue'
import { useStore } from '@nanostores/vue'

import {
  $showPrompt,
  $valueCompleted,
  extendPromptTimeout,
  clearPromptTimeout,
  resetPrompt,
  $nonFinalNum,
  handleVoiceSelection,
} from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'
import { ding, soundManager } from '../ding.ts'
import StageControl from './StageControl.vue'

import { EndingKeyframes } from '../character'
import { $currentScene } from '../store/scene'
import { prevStep } from '../store/choice'
import { resetAction } from '../command'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
// const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  await world.preload()
  await world.setup()

  window.addEventListener('keydown', async (event) => {
    if (
      event.key === ' ' ||
      event.key === 'PageDown' ||
      event.key === 'ArrowRight'
    ) {
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
        console.log('--- STOP LISTENING! ---')

        world.voice.stop()
        $showPrompt.set(false)

        clearPromptTimeout('prompt deactivated')
      }
    }

    if (event.key === 'r' && event.ctrlKey) {
      await resetAction()
    }

    if (event.key === 'g' && event.ctrlKey) {
      world.characters.forEach((character) => {
        if (character.boneRotation?.isPostureActive) {
          character.boneRotation.stop()
        } else if (
          character.params?.axisPoint?.frequency &&
          character.params.axisPoint.frequency > 0
        ) {
          character.boneRotation?.start()
        }
      })
    }

    // reset character mixer time - rewind the tape
    if (event.key === 'c' && event.ctrlKey) {
      world.characters.forEach((character) => {
        if (!character.mixer) return

        character.mixer.setTime(0)
      })
    }

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

    if (event.key === 'g' || event.key === 'ำ') {
      if (world.flags.waitingEndingStart) {
        world.fadeInSceneContent()

        world.flags.waitingEndingStart = false
        return
      }

      if (world.isEnding) return $currentScene.set('BLACK')

      $currentScene.set('ENDING')
    }

    if (event.key === 'h' || event.key === 'ี') {
      world.startShadowCharacter()
    }

    if (event.key === 'i' || event.key === 'ร') {
      world.startDissolveCharacter()
    }

    if (event.key === 'f' && event.ctrlKey) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }

    if (event.key === 'b' && event.ctrlKey) {
      prevStep()
    }

    if (event.key === 'j' && event.ctrlKey) {
      console.log(`FORCE RESTART RECOGNIZER`)
      world.voice.stop()

      setTimeout(() => {
        world.voice.startRecognition('FORCE RESTART')
      }, 50)
    }

    if (event.key === 'k' && event.ctrlKey) {
      speechSynthesis.cancel()
      console.log(`FORCE STOP RECOGNIZER+SPEECH`)
      world.voice.stop()
    }

    if (event.key === 'l' && event.ctrlKey) {
      const nfn = $nonFinalNum.get()
      console.log(`INSERT NONFINAL NUM: ${nfn}`)

      if (nfn !== null) {
        handleVoiceSelection(nfn, true)
      }
    }

    const numbersOnKeypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

    if (numbersOnKeypad.includes(event.key) && event.ctrlKey) {
      const nfn = parseInt(event.key)
      console.log(`nfn: ${nfn}`)
      $nonFinalNum.set(nfn)
      handleVoiceSelection(nfn, true)
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
