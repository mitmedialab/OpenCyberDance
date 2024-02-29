<template>
  <code
    fixed
    font-mono
    top-4
    left-4
    text-white
    whitespace-pre
    bg-gray-900
    px-4
    py-4
    rounded-lg
  >
    {{ JSON.stringify(log, null, 2) }}
  </code>
</template>

<script lang="ts" setup>
import { useStore } from '@nanostores/vue'
import { $debugLog } from '../store/debug'

const log = useStore($debugLog)
</script>
