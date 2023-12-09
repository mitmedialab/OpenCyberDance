import { CharacterKey } from './character'
import { world } from './world'

export const storageKeys = {
  character: 'DEFAULT_CHAR',
  action: 'DEFAULT_ACTION',
}

export const persistCharacter = () => {
  localStorage.setItem(
    storageKeys.character,
    world.first?.options.model ?? null,
  )

  localStorage.setItem(storageKeys.action, world.first?.options.action ?? null)
}

export const getPersistCharacter = () => ({
  character: localStorage.getItem(storageKeys.character) as CharacterKey,
  action: localStorage.getItem(storageKeys.action) as string,
})

export async function changeCharacter(name: CharacterKey) {
  const char = world.characterByName(name)
  if (!char) return

  await char.reset()

  // Sync animation timing with a peer.
  const peer = world.characters.find((c) => c.options.name !== name)
  if (peer?.mixer && char.mixer) char.mixer.setTime(peer.mixer.time)

  persistCharacter()
}

export function changeAction(name: CharacterKey) {
  const action = world.params.characters[name].action
  const character = world.characterByName(name)
  if (!character || !action) return

  character.playByName(action)

  persistCharacter()
}

export function switchDance(key: string) {}
