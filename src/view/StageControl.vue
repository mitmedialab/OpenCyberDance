<template>
  <div flex fixed bottom-4 right-4 gap-x-2 text-3 class="group">
    <!-- <div
      px-1
      py-1
      text-gray-200
      hover:text-green-300
      cursor-pointer
      @click="toggleFullscreen"
    >
      FS
    </div> -->

    <!-- <SceneChanger /> -->

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

    <div flex text-gray-700>
      <input
        v-model="volume"
        class="w-[25px] bg-transparent outline-none appearance-none border-none text-gray-700 focus:text-gray-300 hover:text-gray-400"
        :class="[{ 'text-red-300': invalid }]"
      />
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'

const volume = ref('1.0')
const invalid = ref(false)

watch(volume, () => {
  const v = parseFloat(volume.value)
  if (isNaN(v) || v < 0 || v > 1) {
    invalid.value = true
    return
  }

  invalid.value = false
})
</script>
