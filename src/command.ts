import { percentToValue } from './math.ts'
import {
  AxisPointControlParts,
  axisPointControlParts,
  CorePartKey,
  coreParts,
  CurvePartKey,
  curveParts,
  DelayPartKey,
  delayParts,
} from './parts.ts'
import { ChoiceKey, choices } from './step-input'
import { appendLog } from './store/status.ts'
import { switchDance } from './switch-dance.ts'
import { Axis, TransformKey } from './transforms.ts'
import { world } from './world'

const toValue = (v: string, min: number, max: number) =>
  percentToValue(parseInt(v), min, max)

export async function runCommand(primary: ChoiceKey, args: string[]) {
  console.log(`executing command: ${primary} [${args.join(' ')}]`)

  const choice = choices[primary]

  let spokenSentence = choice?.title ?? primary

  if (args.length > 0) {
    const argsText = args
      .map((a, i) => {
        const step = choice?.steps[i]

        if (!step) return a
        if (step.type === 'percent') return `${a} percent`

        if (step.type === 'choice') {
          const target = step.choices.find((c) => c.key === a || c.title === a)

          if (target && step.meta === 'ordered') {
            return target.title.replace(/^\d+\.\s*/, '')
          }

          if (target) {
            return target.title
          }
        }

        return a
      })
      .join(' ')

    spokenSentence += ` ${argsText}`
  }

  appendLog(spokenSentence)

  world.voice.stop('run command done')
  await world.voice.speak(spokenSentence)

  if (primary === 'curve') {
    const [equationText, partText, percText] = args
    const equation = equationText as TransformKey

    world.params.curve.equation = equation

    for (const part in curveParts) {
      world.params.curve.parts[part as CurvePartKey] =
        partText === 'all' ? true : partText === part
    }

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

    setTimeout(() => {
      world.updateParams({ curve: true })
    }, 80)

    return
  }

  if (primary === 'energy') {
    const [partText, percText] = args

    const value = toValue(percText, 0, 3)

    if (partText === 'all') {
      Object.keys(coreParts).forEach((part) => {
        world.params.energy[part as CorePartKey] = value
      })
    } else if (partText === 'reset') {
      for (const part in coreParts) {
        world.params.energy[part as CorePartKey] = 1
      }
    } else {
      world.params.energy[partText as CorePartKey] = value
    }

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  if (primary === 'shifting') {
    const [partText, percText] = args

    const value = toValue(percText, 0, 3)

    if (partText === 'all') {
      Object.keys(delayParts).forEach((part) => {
        world.params.delays[part as DelayPartKey] = value
      })
    } else {
      world.params.delays[partText as DelayPartKey] = value
    }

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  if (primary === 'space') {
    // delay %
    const [percText] = args
    world.params.space.delay = toValue(percText, 0, 2)

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  // Axis Point
  if (primary === 'axis') {
    const [partText, percText] = args

    for (const part in axisPointControlParts) {
      world.params.axisPoint.parts[part as AxisPointControlParts] =
        partText === 'all' ? true : partText === part
    }

    world.params.axisPoint.threshold = toValue(percText, 0, 10)

    setTimeout(() => {
      world.updateParams({ axisPoint: true })
    }, 80)

    return
  }

  if (primary === 'rotations') {
    const [axis, perc] = args

    const value = toValue(perc, 1, 3.5)

    if (axis === 'all') {
      world.params.rotations.x = value
      world.params.rotations.y = value
      world.params.rotations.z = value
    } else {
      for (const a of ['x', 'y', 'z']) {
        world.params.rotations[a as Axis] = a === axis ? value : 1
      }
    }

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

      character.mixer.timeScale = percentToValue(parseInt(percText), 0, 1, 300)
    }
  }

  if (primary === 'dances') {
    const [danceName] = args

    console.log('switching dance', danceName)
    switchDance(danceName).then()
  }
}
