<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useStore } from '@nanostores/vue'
import * as Tone from 'tone'

import { $showPrompt, resetPrompt } from '../store/choice'

import { world } from '../world'

import StepPrompt from './StepPrompt.vue'

const showPrompt = useStore($showPrompt)

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()

function ding() {
  const synth = new Tone.Synth().toDestination()
  const now = Tone.now()

  synth.triggerAttack('C4', now)
  synth.triggerRelease(now + 1)
}

onMounted(async () => {
  await world.setup()

  window.addEventListener('keydown', async (event) => {
    await Tone.start()

    if (event.key === ' ') {
      const next = !showPrompt.value

      resetPrompt()
      $showPrompt.set(next)
      world.voice.start()

      if (next) ding()
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
