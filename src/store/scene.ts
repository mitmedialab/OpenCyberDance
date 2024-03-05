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
    world.params.reset()
    world.params.lockPosition = false

    await world.fadeInBlankScene()

    world.flags.waitingEndingStart = true
  }

  // Large characters dancing
  if (mode === 'BLACK') {
    world.params.lockPosition = true
    await world.fadeInBlankScene()
    await world.fadeInSceneContent()

    // reset flags for ending scene...
    world.flags.waitingEndingStart = false
  }

  console.log(`> next scene loaded`)
})
