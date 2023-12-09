import { percentToValue } from './math.ts'
import { CorePartKey, CurvePartKey, curveParts, DelayPartKey } from './parts.ts'
import { ChoiceKey } from './step-input'
import { Axis, TransformKey } from './transforms.ts'
import { world } from './world'

const toValue = (v: string, min: number, max: number) =>
  percentToValue(parseInt(v), min, max)

export function runCommand(primary: ChoiceKey, args: string[]) {
  console.log(`executing command: ${primary} [${args.join(' ')}]`)

  let spokenSentence = `${primary}}`
  if (args.length > 0) {
    spokenSentence += `${args.join(' ')}`
  }

  world.voice.stop('run command done')
  world.voice.speak(spokenSentence).then()

  if (primary === 'curve') {
    const [equationText, partText, percText] = args
    const equation = equationText as TransformKey

    world.params.curve.equation = equation
    console.log('--- curve [parts]')

    for (const part in curveParts) {
      world.params.curve.parts[part as CurvePartKey] =
        partText === 'all' ? true : partText === part
    }

    console.log('--- curve [threshold]')

    switch (equation) {
      case 'derivative':
        // always use first-order derivative
        world.params.curve.threshold = 1
        break
      case 'lowpass':
        world.params.curve.threshold = toValue(percText, 1, 1500)
        break
      case 'gaussian':
      case 'capMin':
      case 'capMax':
        world.params.curve.threshold = toValue(percText, -2, 3)
        break
    }

    console.log('--- curve [update:params]')
    console.log(world.params.curve)

    setTimeout(() => {
      world.updateParams({ curve: true })
    }, 80)

    console.log('--- curve [updated]')

    return
  }

  if (primary === 'energy') {
    const [partText, percText] = args
    world.params.energy[partText as CorePartKey] = toValue(percText, 0, 3)

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  if (primary === 'shifting') {
    const [partText, percText] = args
    world.params.delays[partText as DelayPartKey] = toValue(percText, 0, 3)

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  if (primary === 'space') {
    // delay %
    const [percText] = args
    world.params.space.delay = toValue(percText, 0, 3)

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  // Axis Point
  if (primary === 'axis') {
    const [partText, percText] = args
    // disable for now
    return
  }

  if (primary === 'rotations') {
    const [axis, perc] = args
    world.params.rotations[axis as Axis] = toValue(perc, 1, 5)

    setTimeout(() => {
      world.updateParams({ rotation: true })
    }, 80)

    return
  }

  if (primary === 'reset') {
    setTimeout(() => {
      for (const character of world.characters) {
        character.setup().then()
      }
    }, 80)

    return
  }

  // animation speed
  if (primary === 'speed') {
    const [percText] = args

    for (const character of world.characters) {
      if (!character.mixer) continue

      character.mixer.timeScale = toValue(percText, 0, 1)
    }
  }
}
