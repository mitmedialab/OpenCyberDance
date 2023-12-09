import { atom, computed } from 'nanostores'

import { ListeningStatus } from '../voice'

export const $status = atom<ListeningStatus>('disabled')
export const $transcript = atom('')
export const $gptResult = atom('')
export const $voiceError = atom<SpeechRecognitionErrorEvent | null>(null)
export const $logs = atom<string[]>([])

export function appendLog(data: string) {
  const logs = $logs.get()

  $logs.set([...logs, data])

  if (logs.length > 5) {
    $logs.set(logs.slice(1))
  }
}

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
