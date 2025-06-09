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
  leftArm: ArmPosture
  rightArm: ArmPosture
}

// Port exact posture definitions from HTML prototype
export const PREDEFINED_POSTURES: Posture[] = [
  {
    name: 'T-Pose',
    description: 'Classic T-pose with arms extended horizontally',
    leftArm: {
      upperarm: { x: 0, y: 0, z: -1.57 }, // -90 degrees (horizontal)
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: 1.57 }, // +90 degrees (horizontal)
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'Victory Pose',
    description: 'Both arms raised high in victory',
    leftArm: {
      upperarm: { x: 0, y: 1.2, z: -1.0 },
      forearm: { x: 0, y: 0, z: -0.5 },
      hand: { x: 0, y: 0, z: 0.3 },
    },
    rightArm: {
      upperarm: { x: 0, y: 1.2, z: 1.0 },
      forearm: { x: 0, y: 0, z: 0.5 },
      hand: { x: 0, y: 0, z: -0.3 },
    },
  },
  {
    name: 'Flexing',
    description: 'Classic bodybuilder flex pose',
    leftArm: {
      upperarm: { x: 0, y: 0.8, z: -1.2 },
      forearm: { x: 0, y: 0, z: -2.0 },
      hand: { x: 0, y: 0, z: 0.5 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0.8, z: 1.2 },
      forearm: { x: 0, y: 0, z: 2.0 },
      hand: { x: 0, y: 0, z: -0.5 },
    },
  },
  {
    name: 'Pointing Forward',
    description: 'Both arms pointing straight ahead',
    leftArm: {
      upperarm: { x: 0, y: 0, z: -0.5 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: 0.5 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'Crossed Arms',
    description: 'Arms crossed over chest',
    leftArm: {
      upperarm: { x: 0, y: 0, z: 0.8 },
      forearm: { x: 0, y: 0, z: 1.2 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: -0.8 },
      forearm: { x: 0, y: 0, z: -1.2 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'Thinking Pose',
    description: 'One hand on chin, one on hip',
    leftArm: {
      upperarm: { x: 0, y: 0.5, z: -0.3 },
      forearm: { x: 0, y: 0, z: -1.5 },
      hand: { x: 0.5, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: 0.8 },
      forearm: { x: 0, y: 0, z: 0.5 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  {
    name: 'Surrender',
    description: 'Hands up in surrender position',
    leftArm: {
      upperarm: { x: 0, y: 1.5, z: -1.3 },
      forearm: { x: 0, y: 0, z: -1.0 },
      hand: { x: 0, y: 0, z: 0.2 },
    },
    rightArm: {
      upperarm: { x: 0, y: 1.5, z: 1.3 },
      forearm: { x: 0, y: 0, z: 1.0 },
      hand: { x: 0, y: 0, z: -0.2 },
    },
  },
  {
    name: 'Dramatic Point',
    description: 'One arm pointing dramatically, other on hip',
    leftArm: {
      upperarm: { x: 0, y: 0, z: 0.5 },
      forearm: { x: 0, y: 0, z: 0.3 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0.8, z: 1.0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
]
