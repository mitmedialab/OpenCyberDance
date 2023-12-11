import { Character, CharacterKey, ModelKey } from './character'
import { world } from './world'

export type DanceConfig = { model: ModelKey; action?: string }

const danceKeyMap: Record<string, DanceConfig> = {
  kukpat: { model: 'kukpat' },
  tranimid: { model: 'tranimid' },
  terry: { model: 'terry' },
  changhung: { model: 'changhung' },
  yokrob: { model: 'yokrob' },
  yokroblingImprovise: {
    model: 'yokroblingImprovise',
    action: 'yokroblingimprovised_chr02.001',
  },
  robot33: { model: 'robot', action: 'no.33_..001' },
  robot57: { model: 'robot', action: 'no.57_.' },
  base33: { model: 'abstract', action: 'no.33_.' },
  base57: { model: 'abstract57', action: 'no57_Tas' },
  base58: { model: 'abstract57', action: 'no58_Tas' },
  base59: { model: 'abstract57', action: 'no59_Tas' },
}

export const storageKeys = {
  model: 'DEFAULT_MODEL',
  action: 'DEFAULT_ACTION',
}

export const persistCharacter = () => {
  localStorage.setItem(storageKeys.model, world.first?.options.model ?? null)
  localStorage.setItem(storageKeys.action, world.first?.options.action ?? null)
}

export const getPersistCharacter = () => ({
  character: localStorage.getItem(storageKeys.model) as CharacterKey,
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

export async function switchDance(key: string) {
  const config = danceKeyMap[key]
  if (!config) return

  const { model, action } = config
  if (!model) return

  if (!Character.sources[model]) {
    console.error(`model ${model} not found`)
    return
  }

  for (const character of world.characters) {
    const name = character.options.name

    world.params.characters[name].model = model
    world.params.characters[name].action = action ?? null

    changeCharacter(name).then()
  }
}
