<template>
  <div flex fixed bottom-4 right-4 gap-x-2 class="group">
    <div v-for="track in tracks">
      <div
        style="user-select: none"
        font-zed
        cursor-pointer
        px-1
        py-1
        bg-transparent
        text-3
        hover:text-gray-500
        :class="[
          {
            'group-hover:text-gray-700': playing !== track,
            'group-hover:text-gray-500': playing === track,
          },
        ]"
        @click="toggleMusic(track)"
      >
        T{{ track }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useStore } from '@nanostores/vue'

import { $musicPlaying, toggleMusic } from '../music'

const playing = useStore($musicPlaying)

const tracks = [1, 2, 3]
</script>
