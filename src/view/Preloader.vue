<template>
  <link
    v-for="source in sources"
    rel="preload"
    as="fetch"
    crossorigin="anonymous"
    :href="`/models/${source}`"
  />
</template>

<script lang="ts" setup>
import { Character } from '../character'

const sources = Object.values(Character.sources)
</script>
