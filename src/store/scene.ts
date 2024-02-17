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

    world.teardown()
    await world.setup()
  }

  // Large characters dancing
  if (mode === 'BLACK') {
    world.params.lockPosition = true

    world.teardown()
    await world.setup()
  }
})
