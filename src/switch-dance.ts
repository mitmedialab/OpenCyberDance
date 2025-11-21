import { Character, CharacterKey, ModelKey } from './character'
import { world } from './world'

export type DanceConfig = { model: ModelKey; action?: string }

const danceKeyMap: Record<string, DanceConfig> = {
  kukpat: { model: 'kukpat' },
  gade: { model: 'gade' },
  o: { model: 'o' },
  yokrob: { model: 'yokrob' },
  yokroblingImprovise: {
    model: 'yokroblingImprovise',
    action: 'yokroblingimprovised_chr02.001',
  },

  // tranimid: { model: 'tranimid' },
  // robot33: { model: 'robot', action: 'no.33_..001' },
  // robot57: { model: 'robot', action: 'no.57_.' },
  // base33: { model: 'abstract', action: 'no.33_.' },
  // base57: { model: 'abstract57', action: 'no57_Tas' },
  // base58: { model: 'abstract57', action: 'no58_Tas' },
  // base59: { model: 'abstract57', action: 'no59_Tas' },
}

export async function switchDancers(key: string) {
  const config = danceKeyMap[key]
  if (!config) return

  const { model, action } = config
  if (!model) return

  if (!Character.sources[model]) {
    console.error(`model ${model} not found`)
    return
  }

  await world.fadeOut()

  for (const character of world.characters) {
    const name = character.options.name

    character.options.model = model
    world.params.characters[name].model = model

    character.options.action = action ?? null
    world.params.characters[name].action = action ?? null

    await changeCharacter(name)
  }

  await world.fadeIn()
}

export async function changeCharacter(name: CharacterKey) {
  const char = world.characterByName(name)
  if (!char) return

  // Teardown and reset the character.
  char.teardown()

  await char.reset()

  // !!! IMPORTANT: positioning lock will not apply if we did not update the parameter once!
  char.updateParams()
}

/**
 * !! THIS IS ONLY USED BY THE INSPECTION PANEL !!!
 *
 * Don't worry about this.
 */
export function changeAction(name: CharacterKey) {
  const action = world.params.characters[name].action
  const character = world.characterByName(name)
  if (!character || !action) return

  character.playByName(action)
}
