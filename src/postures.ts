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
]
