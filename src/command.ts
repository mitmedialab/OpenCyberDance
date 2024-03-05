import { ModelKey } from './character.ts'
import { percentToValue } from './math.ts'
import {
  CurvePartKey,
  curveParts,
  DelayPartKey,
  delayParts,
  EnergyPartKey,
  energyParts,
} from './parts.ts'
import { ChoiceKey, choices, Step } from './step-input'
import { appendLog } from './store/status.ts'
import { changeCharacter, switchDancers } from './switch-dance.ts'
import { Axis } from './transforms.ts'
import { ENDING_SPEED, world } from './world'

const toPercent = (v: number, min: number, max: number) =>
  ((v - min) / (max - min)) * 100

export type FromPercentMap = Record<ChoiceKey, (input: string) => number>

const rangeConfig: Record<
  ChoiceKey,
  [min: number, max: number, maxPerc?: number]
> = {
  energy: [0, 1, 300],
  curve: [-2, 3],
  shifting: [0, 100],
  space: [0, 1.5],
  rotations: [1, 3.5],
  speed: [0, 1, 300],

  // no op
  reset: [0, 0],
  dances: [0, 0],
}

const p2v = (key: string, input: string): number => {
  const [min, max, maxPerc] = rangeConfig[key as ChoiceKey]

  return percentToValue(parseInt(input), min, max, maxPerc)
}

export const v2p = (key: string, value: number): number => {
  const [min, max] = rangeConfig[key as ChoiceKey]

  return toPercent(value, min, max)
}

export const FromPercent: FromPercentMap = {
  curve: (input: string) =>
    p2v('curve', Math.abs(100 - parseInt(input)).toString()),

  energy: (input: string) => p2v('energy', input),
  shifting: (input: string) => p2v('shifting', input),
  speed: (input: string) => p2v('speed', input),
  space: (input: string) => p2v('space', input),
  rotations: (input: string) => p2v('rotations', input),
  // axis: (input: string) => toValue(input, 0, 10),

  // -- no op --
  reset: () => 0,
  dances: () => 0,
}

export const CurrentPercent = {
  energy: (part: EnergyPartKey) => v2p('energy', world.params.energy[part]),
  curve: () => {
    const c = v2p('curve', world.params.curve.threshold)
    if (isNaN(c)) return 0

    return Math.abs(100 - c)
  },
  shifting: (part: DelayPartKey) => v2p('shifting', world.params.delays[part]),
  speed: () => v2p('speed', world.params.timescale),
  space: () => v2p('space', world.params.space.delay),
  rotations: (axis: Axis) => v2p('rotations', world.params.rotations[axis]),
  // axis: () => toPercent(world.params.axisPoint.threshold, 0, 10),
}

export async function runCommand(primary: ChoiceKey, args: string[]) {
  console.log(`executing command: ${primary} [${args.join(' ')}]`)

  const choice = choices[primary]

  let spokenSentence = choice?.title ?? primary

  if (args.length > 0) {
    const argsText = args
      .map((a, i) => {
        const step = choice?.steps[i] as Step

        if (!step) return a
        if (step.type === 'percent') return `${a} percent`

        if (step.type === 'choice') {
          // TODO: add a condition to use the splitted word
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
    const [partText, percText] = args

    const _percent = parseInt(percText)

    // Normal = 100%
    const isNormal = _percent === 100

    world.params.curve.threshold = FromPercent.curve(percText)
    world.params.curve.equation = isNormal ? 'none' : 'capMin'

    for (const part in curveParts) {
      world.params.curve.parts[part as CurvePartKey] =
        partText === 'all' ? true : partText === part
    }

    setTimeout(() => {
      world.updateParams({ curve: true })
    }, 80)

    return
  }

  if (primary === 'energy') {
    const [partText, percText] = args

    const value = FromPercent.energy(percText)

    if (partText === 'all') {
      Object.keys(energyParts).forEach((part) => {
        world.params.energy[part as EnergyPartKey] = value
      })
    } else if (partText === 'reset') {
      for (const part in energyParts) {
        world.params.energy[part as EnergyPartKey] = 1
      }
    } else {
      world.params.energy[partText as EnergyPartKey] = value
    }

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  if (primary === 'shifting') {
    const [partText, percText] = args

    const value = FromPercent.shifting(percText)

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
    world.params.space.delay = FromPercent.space(percText)
    world.params.space.threshold = FromPercent.shifting(percText) / 100

    setTimeout(() => {
      world.updateParams()
    }, 80)

    return
  }

  // Axis Point
  // if (primary === 'axis') {
  //   const [partText, percText] = args

  //   for (const part in axisPointControlParts) {
  //     world.params.axisPoint.parts[part as AxisPointControlParts] =
  //       partText === 'all' ? true : partText === part
  //   }

  //   world.params.axisPoint.threshold = FromPercent.axis(percText)

  //   setTimeout(() => {
  //     world.updateParams({ axisPoint: true })
  //   }, 80)

  //   return
  // }

  if (primary === 'rotations') {
    const [axis, perc] = args

    const value = FromPercent.rotations(perc)

    if (axis === 'all') {
      world.params.rotations.x = value
      world.params.rotations.y = value
      world.params.rotations.z = value
    } else if (axis === 'reset') {
      world.params.rotations.x = 1
      world.params.rotations.y = 1
      world.params.rotations.z = 1
    } else {
      for (const a of ['x', 'y', 'z']) {
        world.params.rotations[a as Axis] = a === axis.trim() ? value : 1
      }
    }

    setTimeout(() => {
      world.updateParams({ rotation: true })
    }, 80)

    return
  }

  // animation speed
  if (primary === 'speed') {
    const [percText] = args

    const speed = FromPercent.speed(percText)
    world.params.timescale = speed

    for (const character of world.characters) {
      if (!character.mixer) continue

      character.mixer.timeScale = speed
    }
  }

  if (primary === 'dances') {
    const [dancerName] = args

    console.log('switching dancer to', dancerName)

    world.params.reset()

    await switchDancers(dancerName)

    return
  }

  if (primary === 'reset') {
    await world.fadeOut()

    // store the currently active animation
    const current: Record<string, { model: ModelKey; action: string }> = {}

    for (const char of world.characters) {
      current[char.options.name] = {
        model: char.options.model,
        action: char.options.action!,
      }
    }

    // reset all parameters
    world.params.reset()

    // apply current animations to the new characters
    for (const char of world.characters) {
      const name = char.options.name
      const { model, action } = current[name]

      char.options.model = model
      char.options.action = action ?? null

      if (world.params.characters?.[name]) {
        world.params.characters[name].model = model
        world.params.characters[name].action = action ?? null
      }

      await changeCharacter(name)
    }

    if (world.isEnding) {
      world.params.timescale = ENDING_SPEED

      for (const char of world.characters) {
        if (!char.mixer) continue

        char.mixer.timeScale = ENDING_SPEED
      }
    }

    await world.fadeIn()

    return
  }
}
