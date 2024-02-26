import { atom, onNotify } from 'nanostores'

import { world } from '../world'

export type SceneMode = 'BLACK' | 'ENDING'

export const $currentScene = atom<SceneMode>('BLACK')

onNotify($currentScene, async () => {
  const mode = $currentScene.get()

  console.log(`> setting scene to ${mode}`)

  // Two characters transitioning from body to shadow
  if (mode === 'ENDING') {
    // Disable position lock as we need characters to walk
    world.params.lockPosition = false
  }

  // Large characters dancing
  if (mode === 'BLACK') {
    world.params.lockPosition = true
  }

  await world.resetWithFade()

  console.log(`> next scene loaded`)
})
