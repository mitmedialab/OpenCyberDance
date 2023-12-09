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

export type Step =
  | { type: 'percent'; max?: number }
  | { type: 'choice'; choices: ChoiceOption[] }

export const steps = {
  percent: { type: 'percent' },

  axes: {
    type: 'choice',
    choices: toOptions('x', 'y', 'z', 'all'),
  },

  // select shifting relations part
  energyParts: {
    type: 'choice',
    choices: toOptions('head', 'body', 'foot', 'all'),
  },

  // select shifting relations part
  shiftingParts: {
    type: 'choice',
    choices: [...armatureParts, ...toOptions('all')],
  },

  curveEquation: {
    type: 'choice',
    choices: [
      { title: 'low pass', key: 'lowpass' },
      { title: 'gaussian', key: 'gaussian' },
      { title: 'derivative', key: 'derivative' },
      { title: 'cap min', key: 'capMin' },
      { title: 'cap max', key: 'capMax' },
    ],
  },

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
      { title: '1. unset', key: 'none' },
      { title: '2. kukpat', key: 'kukpat' },
      { title: '3. tranimid', key: 'tranimid' },
      { title: '4. terry', key: 'terry' },
      { title: '5. changhung', key: 'changhung' },
      { title: '6. yokrob', key: 'yokrob' },
      { title: '7. yokrob ling', key: 'yokroblingImprovise' },
      { title: '8. robot 33', key: 'robot33' },
      { title: '9. robot 57', key: 'robot57' },
      { title: '10. base 33', key: 'base33' },
      { title: '11. base 57', key: 'base57' },
    ],
  },
} satisfies Record<string, Step>

export type StepKey = keyof typeof steps

export interface Choice {
  title: string
  triggers: string[]
  steps: Step[]
  hidden?: boolean
}

export const choices = {
  energy: {
    title: 'energy',
    triggers: ['energy'],
    steps: [steps.energyParts, steps.percent],
  },
  curve: {
    title: 'circle and curve',
    triggers: ['circle'],
    steps: [steps.curveEquation, steps.curveParts, steps.percent],
  },
  shifting: {
    title: 'shifting relations',
    triggers: ['shifting', 'synchronic', 'sync', 'relations'],
    steps: [steps.shiftingParts, steps.percent],
  },
  space: {
    title: 'external body space',
    triggers: ['space'],
    steps: [steps.percent],
  },
  // axis: {
  //   title: 'axis point',
  //   triggers: ['axis'],
  //   steps: [steps.axisParts, steps.percent],
  //   hidden: true,
  // },
  rotations: {
    title: 'rotations',
    triggers: ['turn', 'rotation'],
    steps: [steps.axes, steps.percent],
  },
  reset: {
    title: 'reset',
    triggers: ['reset'],
    steps: [],
  },
  speed: {
    title: 'animation speed',
    triggers: ['speed'],
    steps: [{ type: 'percent', max: 300 }],
  },
  dances: {
    title: 'dances',
    triggers: ['dances'],
    steps: [steps.dances],
  },
} satisfies Record<string, Choice>

export type ChoiceKey = keyof typeof choices
