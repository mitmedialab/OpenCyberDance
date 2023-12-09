import { atom, computed } from 'nanostores'
import { watch } from 'vue'

import { ListeningStatus } from '../voice'
import { world } from '../world.ts'
import { $showPrompt } from './choice.ts'

export const $status = atom<ListeningStatus>('disabled')
export const $transcript = atom('')
export const $gptResult = atom('')

export const $result = computed($gptResult, (result) => {
  if (!result) return null

  try {
    return JSON.parse(result)
  } catch (err) {
    return null
  }
})

export const $understand = computed($gptResult, (result) => {
  if (!result) return true

  try {
    JSON.parse(result)
    return true
  } catch (err) {
    return false
  }
})
