import { percentToValue } from './math.ts'
import { CorePartKey, CurvePartKey, curveParts, DelayPartKey } from './parts.ts'
import { ChoiceKey } from './step-input'
import { Axis, TransformKey } from './transforms.ts'
import { world } from './world'

const toValue = (v: string, min: number, max: number) =>
  percentToValue(parseInt(v), min, max)

export function runCommand(primary: ChoiceKey, args: string[]) {
  world.voice.stop()
  console.log(`executing command: ${primary} [${args.join(' ')}]`)

  if (primary === 'curve') {
    const [equationText, partText, percText] = args

    const equation = equationText as TransformKey

    world.params.curve.equation = equation

    if (partText === 'all') {
      Object.keys(curveParts).forEach((part) => {
        world.params.curve.parts[part as CurvePartKey] = true
      })
    } else {
      Object.keys(curveParts).forEach((part) => {
        world.params.curve.parts[partText as CurvePartKey] = partText === part
      })
    }

    switch (equation) {
      case 'derivative':
        // always use first-order derivative
        world.params.curve.threshold = 1
        break
      case 'lowpass':
        world.params.curve.threshold = toValue(percText, 1, 2000)
        break
      case 'gaussian':
      case 'capMin':
      case 'capMax':
        world.params.curve.threshold = toValue(percText, -2, 3)
        break
    }

    world.updateParams({ curve: true })
  }

  if (primary === 'energy') {
    const [partText, percText] = args
    world.params.energy[partText as CorePartKey] = toValue(percText, 0, 3)

    world.updateParams()
    return
  }

  if (primary === 'shifting') {
    const [partText, percText] = args
    world.params.delays[partText as DelayPartKey] = toValue(percText, 0, 3)
    world.updateParams()
    return
  }

  if (primary === 'space') {
    // delay %
    const [percText] = args
    world.params.space.delay = toValue(percText, 0, 3)
    world.updateParams()
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
    world.updateParams({ rotation: true })
    return
  }

  if (primary === 'reset') {
    for (const character of world.characters) {
      character.setup().then()
    }

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
