<template>
  <div flex fixed bottom-4 right-4 gap-x-2 font-zed text-3 class="group">
    <div
      px-1
      py-1
      text-gray-600
      hover:text-gray-400
      cursor-pointer
      @click="toggleFullscreen"
    >
      FS
    </div>

    <SceneChanger />

    <!-- <div v-for="track in tracks">
      <div
        style="user-select: none"
        cursor-pointer
        px-1
        py-1
        bg-transparent
        hover:text-gray-300
        :class="[
          {
            'text-gray-700': playing !== track,
            'text-gray-400': playing === track,
          },
        ]"
        @click="toggleMusic(track)"
      >
        T{{ track }}
      </div>
    </div>

    <div flex font-zed text-gray-700>
      <input
        v-model="volume"
        class="w-[25px] bg-transparent outline-none font-zed appearance-none border-none text-gray-700 focus:text-gray-300 hover:text-gray-400"
        :class="[{ 'text-red-300': invalid }]"
      />
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useStore } from '@nanostores/vue'

import { $musicPlaying, toggleMusic, setVolume } from '../music'

import SceneChanger from './SceneChanger.vue'

const volume = ref('1.0')
const invalid = ref(false)

const playing = useStore($musicPlaying)

const tracks = [1, 2, 3]

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else if (document.exitFullscreen) {
    document.exitFullscreen()
  }
}

watch(volume, () => {
  const v = parseFloat(volume.value)
  if (isNaN(v) || v < 0 || v > 1) {
    invalid.value = true
    return
  }

  invalid.value = false
  setVolume(v)
})
</script>
