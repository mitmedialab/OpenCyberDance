// Posture definitions ported from axis-point-prototype.html

// Arm posture definition structure from HTML prototype
export interface ArmPosture {
  upperarm: { x: number; y: number; z: number }
  forearm: { x: number; y: number; z: number }
  hand: { x: number; y: number; z: number }
}

export interface Posture {
  name: string
  description: string
  leftArm?: ArmPosture
  rightArm?: ArmPosture
  head?: { x: number; y: number; z: number }
}

// Port exact posture definitions from HTML prototype
export const PREDEFINED_POSTURES: Posture[] = [
  {
    name: 'left arm left',
    description: 'left arm to the left',
    leftArm: {
      upperarm: { x: 6, y: 1.7, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: -1, z: 0 },
    },
  },
  {
    name: 'right arm right',
    description: 'right arm to the right',
    rightArm: {
      upperarm: { x: -6, y: 1.7, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'both arms front',
    description: 'both arms pointing straight to the front',
    leftArm: {
      upperarm: { x: 0, y: -1.2, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 1.2, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'both arms up',
    description: 'both arms raised straight up',
    leftArm: {
      upperarm: { x: 5, y: 5, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: -5, y: 5, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'both arms side',
    description: 'both arms extended to the sides',
    leftArm: {
      upperarm: { x: 6, y: 1.7, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: -6, y: 1.7, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'left hand to hip',
    description: 'left hand to the hip',
    leftArm: {
      upperarm: { x: 2.2, y: 0.73, z: 3.49 },
      forearm: { x: 6, y: -6, z: -3 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'right hand to head',
    description: 'right hand to the head',
    rightArm: {
      upperarm: { x: 2.2, y: 0.73, z: 3.49 },
      forearm: { x: 6, y: 3.73, z: 0.85 },
      hand: { x: -1.17, y: 0, z: 0 },
    },
  },
  {
    name: 'head nod',
    description: 'gentle forward nod',
    head: { x: 0.5, y: 0, z: 0 },
  },
  {
    name: 'head up',
    description: 'gentle forward nod',
    head: { x: -0.3, y: 0, z: 0 },
  },
  {
    name: 'head look left',
    description: 'turn head to the left',
    head: { x: 0, y: 0.7, z: 0 },
  },
  {
    name: 'head look right',
    description: 'turn head to the right',
    head: { x: 0, y: -0.7, z: 0 },
  },
  {
    name: 'head tilt left',
    description: 'tilt head to the left shoulder',
    head: { x: 0, y: 0, z: 0.25 },
  },
  {
    name: 'head tilt right',
    description: 'tilt head to the right shoulder',
    head: { x: 0, y: 0, z: -0.25 },
  },
]
