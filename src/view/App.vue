<script lang="ts" setup>
import { ref, onMounted } from 'vue'

import { World } from '../world'

const rendererElement = ref<HTMLDivElement>()
const plotterContainer = ref<HTMLDivElement>()
const statsContainer = ref<HTMLDivElement>()

onMounted(async () => {
  const world = new World()
  await world.setup()

  rendererElement.value?.appendChild(world.renderer.domElement)
  statsContainer.value?.appendChild(world.stats.dom)

  if (world.plotter.domElement) {
    plotterContainer.value?.appendChild(world.plotter.domElement)
  }

  world.render()
})
</script>

<template>
  <div>
    <div ref="rendererElement" />
    <div ref="plotterContainer" />
    <div ref="statsContainer" />
  </div>
</template>
