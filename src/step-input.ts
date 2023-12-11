import { CurrentPercent } from './command.ts'
import { AxisPointControlParts, DelayPartKey, EnergyPartKey } from './parts.ts'
import { $selectedValues } from './store/choice.ts'
import { Axis } from './transforms.ts'

const armatureParts = [
  { title: 'left arm', key: 'leftArm' },
  { title: 'right arm', key: 'rightArm' },
  { title: 'left leg', key: 'leftLeg' },
  { title: 'right leg', key: 'rightLeg' },
]

export interface ChoiceOption {
  title: string
  key: string
  alts?: string[]
}

const toOptions = (...options: string[]): ChoiceOption[] =>
  options.map((option) => ({ title: option, key: option }))

export interface PercentStep {
  type: 'percent'
  max?: number
  current?: () => number
}

export interface ChoiceStep {
  type: 'choice'
  choices: ChoiceOption[]
  meta?: 'ordered'
}

export type Step = PercentStep | ChoiceStep

export const steps = {
  percent: { type: 'percent' },

  axes: {
    type: 'choice',
    choices: toOptions('x', 'y', 'z', 'all', 'reset'),
  },

  // select shifting relations part
  energyParts: {
    type: 'choice',
    choices: [
      { title: 'upper body', key: 'upper' },
      { title: 'lower body', key: 'lower' },
      { title: 'reset', key: 'reset' },
    ],
  },

  // select shifting relations part
  // ! SHIFTING RELATION SHOULD NOT INCLUDE [ALL] to prevent them being in sync
  shiftingParts: {
    type: 'choice',
    choices: [...armatureParts],
  },

  // curveEquation: {
  //   type: 'choice',
  //   choices: [
  //     { title: '1. low pass', key: 'lowpass' },
  //     { title: '2. gaussian', key: 'gaussian' },
  //     { title: '3. derivative', key: 'derivative' },
  //     { title: '4. cap min', key: 'capMin' },
  //     { title: '5. cap max', key: 'capMax' },
  //   ],
  //   meta: 'ordered',
  // },

  curveParts: {
    type: 'choice',
    choices: [
      ...toOptions('head', 'body'),
      ...armatureParts,
      ...toOptions('all'),
    ],
  },

  axisParts: {
    type: 'choice',
    choices: [...armatureParts, ...toOptions('all')],
  },

  dances: {
    type: 'choice',
    choices: [
      { title: '1. tas kukpat', key: 'kukpat' },
      { title: '2. tranimid', key: 'tranimid' },
      { title: '3. terry', key: 'terry' },
      { title: '4. changhung', key: 'changhung' },
      { title: '5. padung yokrob', key: 'yokrob' },
      { title: '6. padung yokrob monkey', key: 'yokroblingImprovise' },
      { title: '7. robot 33', key: 'robot33' },
      { title: '8. robot 57', key: 'robot57' },
      { title: '9. base 33', key: 'base33' },
      { title: '10. base 57', key: 'base57' },
      { title: '11. base 58', key: 'base58' },
      { title: '12. base 59', key: 'base59' },
      // { title: '11. unset', key: 'none' },
    ],
    meta: 'ordered',
  },
} satisfies Record<string, Step>

export type StepKey = keyof typeof steps

export const choices = {
  energy: {
    title: 'energy',
    triggers: ['energy'],
    steps: [
      steps.energyParts,
      {
        type: 'percent',
        max: 300,
        current() {
          const values = $selectedValues.get()
          console.log('curr', values[0])

          return CurrentPercent.energy(values[0] as EnergyPartKey)
        },
      },
    ],
  },
  curve: {
    title: 'circle and curve',
    triggers: ['circle'],
    steps: [
      steps.curveParts,
      {
        type: 'percent',
        current: () => CurrentPercent.curve(),
      },
    ],
  },
  shifting: {
    title: 'shifting relations',
    triggers: ['shifting', 'synchronic', 'sync', 'relations'],
    steps: [
      steps.shiftingParts,
      {
        type: 'percent',
        current() {
          const values = $selectedValues.get()

          return CurrentPercent.shifting(values[0] as DelayPartKey)
        },
      },
    ],
  },
  space: {
    title: 'external body space',
    triggers: ['space'],
    steps: [
      {
        type: 'percent',
        current: () => CurrentPercent.space(),
      },
    ],
  },
  axis: {
    title: 'axis point',
    triggers: ['axis'],
    steps: [
      steps.axisParts,

      {
        type: 'percent',
        current() {
          const values = $selectedValues.get()

          return CurrentPercent.axis(values[0] as AxisPointControlParts)
        },
      },
    ],
  },
  rotations: {
    title: 'rotations',
    triggers: ['turn', 'rotation'],
    steps: [
      steps.axes,
      {
        type: 'percent',
        current() {
          const values = $selectedValues.get()

          if (values[0] === 'all' || values[0] === 'reset') return 0

          return CurrentPercent.rotations(values[0] as Axis)
        },
      },
    ],
  },
  reset: {
    title: 'reset',
    triggers: ['reset'],
    steps: [],
  },
  speed: {
    title: 'dance speed',
    triggers: ['speed'],
    steps: [
      {
        type: 'percent',
        max: 300,
        current: () => CurrentPercent.speed(),
      },
    ],
  },
  dances: {
    title: 'dancers',
    triggers: ['dances'],
    steps: [steps.dances],
  },
} satisfies Record<string, Choice>

type Choices = typeof choices

export interface Choice {
  title: string
  triggers: string[]
  steps: Step[]
  hidden?: boolean
}

export type ChoiceKey = keyof Choices
