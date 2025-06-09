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
  // {
  //   name: 'T-Pose',
  //   description: 'Classic T-pose with arms extended horizontally',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0, z: -1.57 }, // -90 degrees (horizontal)
  //     forearm: { x: -1.2, y: 0, z: 0 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 0, z: 1.57 }, // +90 degrees (horizontal)
  //     forearm: { x: -1.2, y: 0, z: 0 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Victory Pose',
  //   description: 'Both arms raised high in victory',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 1.2, z: -1.0 },
  //     forearm: { x: -1.2, y: 0, z: -0.5 },
  //     hand: { x: -1.2, y: 0, z: 0.3 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 1.2, z: 1.0 },
  //     forearm: { x: -1.2, y: 0, z: 0.5 },
  //     hand: { x: -1.2, y: 0, z: -0.3 },
  //   },
  // },
  // {
  //   name: 'Flexing',
  //   description: 'Classic bodybuilder flex pose',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0.8, z: -1.2 },
  //     forearm: { x: -1.2, y: 0, z: -2.0 },
  //     hand: { x: -1.2, y: 0, z: 0.5 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 0.8, z: 1.2 },
  //     forearm: { x: -1.2, y: 0, z: 2.0 },
  //     hand: { x: -1.2, y: 0, z: -0.5 },
  //   },
  // },
  {
    name: 'T-Pose Test',
    description: 'T-Posed',
    leftArm: {
      upperarm: { x: 0, y: 0, z: 6 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: -6 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  },
  // {
  //   name: 'Left Arm Pointing Forward',
  //   description: 'Left arm pointing straight ahead',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0, z: -0.5 },
  //     forearm: { x: -1.2, y: 0, z: 0 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  //   // rightArm: {
  //   //   upperarm: { x: -1.2, y: 0, z: 0.5 },
  //   //   forearm: { x: -1.2, y: 0, z: 0 },
  //   //   hand: { x: -1.2, y: 0, z: 0 },
  //   // },
  // },
  // {
  //   name: 'Crossed Arms',
  //   description: 'Arms crossed over chest',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0, z: 0.8 },
  //     forearm: { x: -1.2, y: 0, z: 1.2 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 0, z: -0.8 },
  //     forearm: { x: -1.2, y: 0, z: -1.2 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Thinking Pose',
  //   description: 'One hand on chin, one on hip',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0.5, z: -0.3 },
  //     forearm: { x: -1.2, y: 0, z: -1.5 },
  //     hand: { x: 0.5, y: 0, z: 0 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 0, z: 0.8 },
  //     forearm: { x: -1.2, y: 0, z: 0.5 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Surrender',
  //   description: 'Hands up in surrender position',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 1.5, z: -1.3 },
  //     forearm: { x: -1.2, y: 0, z: -1.0 },
  //     hand: { x: -1.2, y: 0, z: 0.2 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 1.5, z: 1.3 },
  //     forearm: { x: -1.2, y: 0, z: 1.0 },
  //     hand: { x: -1.2, y: 0, z: -0.2 },
  //   },
  // },
  // {
  //   name: 'Dramatic Point',
  //   description: 'One arm pointing dramatically, other on hip',
  //   leftArm: {
  //     upperarm: { x: -1.2, y: 0, z: 0.5 },
  //     forearm: { x: -1.2, y: 0, z: 0.3 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  //   rightArm: {
  //     upperarm: { x: -1.2, y: 0.8, z: 1.0 },
  //     forearm: { x: -1.2, y: 0, z: 0 },
  //     hand: { x: -1.2, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Left Shoulder Forward',
  //   description: 'Left hand straight ahead at shoulder level, right arm down',
  //   leftArm: {
  //     upperarm: { x: -5, y: 0, z: -0.8 }, // Strong forward + horizontal + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Strong forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  //   // rightArm: {
  //   //   // Don't move right arm - leave in natural position
  //   // },
  // },
  // {
  //   name: 'Right Shoulder Forward',
  //   description: 'Right hand straight ahead at shoulder level, left arm down',
  //   // leftArm: {
  //   //   // Don't move left arm - leave in natural position
  //   // },
  //   rightArm: {
  //     upperarm: { x: -5, y: 0, z: 0.8 }, // Strong forward + horizontal + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Strong forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Left Diagonal Front-Left',
  //   description: 'Left hand diagonally to the front-left (-45 degrees)',
  //   leftArm: {
  //     upperarm: { x: -5, y: 0.6, z: -0.9 }, // Forward + diagonal up + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  //   // rightArm: {
  //   //   // Don't move right arm - leave in natural position
  //   // },
  // },
  // {
  //   name: 'Right Diagonal Front-Left',
  //   description: 'Right hand diagonally to the front-left (-45 degrees)',
  //   // leftArm: {
  //   //   // Don't move left arm - leave in natural position
  //   // },
  //   rightArm: {
  //     upperarm: { x: -5, y: 0.6, z: 0.9 }, // Forward + diagonal up + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  // },
  // {
  //   name: 'Left Diagonal Front-Right',
  //   description: 'Left hand diagonally to the front-right (45 degrees)',
  //   leftArm: {
  //     upperarm: { x: -5, y: -0.6, z: -0.9 }, // Forward + diagonal down + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  //   // rightArm: {
  //   //   // Don't move right arm - leave in natural position
  //   // },
  // },
  // {
  //   name: 'Right Diagonal Front-Right',
  //   description: 'Right hand diagonally to the front-right (45 degrees)',
  //   // leftArm: {
  //   //   // Don't move left arm - leave in natural position
  //   // },
  //   rightArm: {
  //     upperarm: { x: -5, y: -0.6, z: 0.9 }, // Forward + diagonal down + outward
  //     forearm: { x: -5, y: 0, z: 0 }, // Forward extension
  //     hand: { x: 0, y: 0, z: 0 },
  //   },
  // },
]
