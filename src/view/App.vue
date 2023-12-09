<script lang="ts" setup>
import { ref, onMounted } from 'vue'

import { World } from '../world'
import StepPrompt from './StepPrompt.vue'

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()

onMounted(async () => {
  const world = new World()
  await world.setup()

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

    <StepPrompt />
  </div>
</template>
