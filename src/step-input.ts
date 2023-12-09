const armatureParts = [
  { title: 'left arm', key: 'leftArm' },
  { title: 'right arm', key: 'rightArm' },
  { title: 'left leg', key: 'leftLeg' },
  { title: 'right leg', key: 'rightLeg' },
]

const toOptions = (...options: string[]) =>
  options.map((option) => ({ title: option, key: option }))

export type Step =
  | { type: 'percent' }
  | { type: 'choice'; choices: { title: string; key: string }[] }

export const steps = {
  percent: { type: 'percent' },

  axes: {
    type: 'choice',
    choices: toOptions('x', 'y', 'z'),
  },

  // select shifting relations part
  energyParts: {
    type: 'choice',
    choices: toOptions('head', 'body', 'foot'),
  },

  // select shifting relations part
  shiftingParts: {
    type: 'choice',
    choices: [...armatureParts, ...toOptions('all')],
  },

  curveEquation: {
    type: 'choice',
    choices: [
      { title: 'a. low pass', key: 'lowpass' },
      { title: 'b. gaussian', key: 'gaussian' },
      { title: 'c. derivative', key: 'derivative' },
      { title: 'd. cap min', key: 'capMin' },
      { title: 'e. cap max', key: 'capMax' },
    ],
  },

  curveParts: {
    type: 'choice',
    choices: [...toOptions('head', 'body'), ...armatureParts],
  },

  axisParts: {
    type: 'choice',
    choices: [...armatureParts, ...toOptions('all')],
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
    triggers: ['shifting', 'synchronic', 'sync'],
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
    steps: [steps.percent],
  },
} satisfies Record<string, Choice>

export type ChoiceKey = keyof typeof choices
