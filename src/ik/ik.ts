import { Bone, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { degToRad, MathUtils } from 'three/src/math/MathUtils'

import { BoneKey } from '../bones'
import { AxisPointConfig } from '../overrides'
import { AxisPointControlParts } from '../parts'
import { CCDIKSolver, IK, IKLink } from './ccd-ik'

declare global {
  interface Window {
    ikManager: IKManager
  }
}

export type ControlPoint = AxisPointControlParts
export type AxisPoint = 'forehead' | 'neck' | 'body'

export type TargetBones = Record<AxisPoint, Bone>
export type ControlBones = Record<ControlPoint, Bone>

/**
 * The targets to interpolate to.
 */
interface InterpolatedKeyframe {
  position: Vector3
  rotation: Quaternion
  step: number
}

const effectorBones: Record<ControlPoint, BoneKey> = {
  leftArm: 'LeftHand',
  rightArm: 'RightHand',
  // leftLeg: 'LeftFoot',
  // rightLeg: 'RightFoot',
}

const refAxisBones: Record<AxisPoint, BoneKey> = {
  forehead: 'Head',
  neck: 'Neck',
  body: 'Spine1',
}

const sixtyDegreesInRadians = (60 * Math.PI) / 180

const maxNegVec = new Vector3(-360, -360, -360)
const maxPosVec = new Vector3(360, 360, 360)

const minNegVec = new Vector3(-0.1, -0.1, -0.1)
const minPosVec = new Vector3(0.1, 0.1, 0.1)

const zeroVec = new Vector3(0, 0, 0)

// Assuming you have a bone or joint object with rotationMin and rotationMax properties
const boneConstraints = {
  rotationMin: new Vector3(
    -sixtyDegreesInRadians,
    -sixtyDegreesInRadians,
    -sixtyDegreesInRadians,
  ),

  rotationMax: new Vector3(
    sixtyDegreesInRadians,
    sixtyDegreesInRadians,
    sixtyDegreesInRadians,
  ),
}

const partConstraints = {
  shoulderRotationMin: new Vector3(
    MathUtils.degToRad(-45), // Pitch backward
    MathUtils.degToRad(-90), // Yaw downward
    MathUtils.degToRad(-60), // Roll inward
  ),

  shoulderRotationMax: new Vector3(
    MathUtils.degToRad(180), // Pitch forward and up
    MathUtils.degToRad(90), // Yaw upward
    MathUtils.degToRad(60), // Roll outward
  ),

  elbowRotationMin: new Vector3(
    0, // No rotation around x-axis
    0, // No rotation around y-axis
    MathUtils.degToRad(0), // Elbow fully extended
  ),

  elbowRotationMax: new Vector3(
    0, // No rotation around x-axis
    0, // No rotation around y-axis
    MathUtils.degToRad(150), // Elbow fully flexed
  ),

  wristRotationMin: new Vector3(
    MathUtils.degToRad(-80), // Flexion
    MathUtils.degToRad(-20), // Radial Deviation
    0, // Typically, no rotation around the z-axis
  ),

  wristRotationMax: new Vector3(
    MathUtils.degToRad(70), // Extension
    MathUtils.degToRad(30), // Ulnar Deviation
    0, // Typically, no rotation around the z-axis
  ),
}

const INTERPOLATE_STEPS = 100

const TARGET_AXIS: AxisPoint = 'body'

export class IKManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh

  waitFrames = 0
  maxWaitFrames = 10

  private interpolating = false

  frameCounters: Record<ControlPoint, number | null> = {
    leftArm: null,
    rightArm: null,
    // leftLeg: null,
    // rightLeg: null,
  }

  targetFrames: Record<ControlPoint, InterpolatedKeyframe[] | null> = {
    leftArm: null,
    rightArm: null,
    // leftLeg: null,
    // rightLeg: null,
  }

  // The target bones are not part of the original skeleton.
  // They are created dynamically to be used as moving targets for the IK solver.
  targetBoneIds: Record<ControlPoint, number> = {
    leftArm: -1,
    rightArm: -1,
    // leftLeg: -1,
    // rightLeg: -1,
  }

  constructor(mesh: SkinnedMesh) {
    this.mesh = mesh
    this.createTargetBones()
    this.updateSkeleton()

    this.ik = new CCDIKSolver(this.mesh, [])

    window.ikManager = this
  }

  /**
   * We create custom bones to use as targets for the IK solver.
   * We will move these bones around to interpolate the movement.
   **/
  private createTargetBones() {
    this.createTargetBone('leftArm', 'LeftArmTarget')
    this.createTargetBone('rightArm', 'RightArmTarget')

    // DISABLE FOR NOW. Axis Point for legs is usually on the ground.
    // this.createTargetBone('leftLeg', 'LeftLegTarget')
    // this.createTargetBone('rightLeg', 'RightLegTarget')
  }

  get linksByControl(): Record<ControlPoint, IKLink[]> {
    return {
      leftArm: [
        {
          index: this.idOf('LeftForeArm'),
          // rotationMin: minNegVec,
          // rotationMax: minPosVec,
          rotationMin: new Vector3(0, 0, 0),
          rotationMax: new Vector3(0, 0, degToRad(150)),
          // rotationMax: partConstraints.elbowRotationMax,
        },
        {
          index: this.idOf('LeftArm'),
          // rotationMin: zeroVec,
          // rotationMax: zeroVec,
          // rotationMin: partConstraints.elbowRotationMin,
          // rotationMax: partConstraints.elbowRotationMax,
          rotationMin: partConstraints.wristRotationMin,
          rotationMax: partConstraints.wristRotationMax,
        },
        // {
        //   index: this.idOf('LeftShoulder'),
        //   rotationMin: zeroVec,
        //   rotationMax: zeroVec,
        //   // rotationMax: partConstraints.shoulderRotationMax,
        //   // rotationMin: partConstraints.shoulderRotationMin,
        // },
        // { index: this.idOf('Spine2') },
      ],

      rightArm: [
        // {
        //   index: this.idOf('RightForeArm'),
        //   rotationMin: boneConstraints.rotationMin,
        //   rotationMax: boneConstraints.rotationMax,
        // },
        // {
        //   index: this.idOf('RightArm'),
        //   rotationMin: boneConstraints.rotationMin,
        //   rotationMax: boneConstraints.rotationMax,
        // },
        // { index: this.idOf('RightShoulder') },
        // { index: this.idOf('Spine2') },
      ],

      // leftLeg: [
      //   { index: this.idOf('LeftLeg') },
      //   { index: this.idOf('LeftUpLeg') },
      //   // { index: this.idOf('Hips') },
      // ],

      // rightLeg: [
      //   { index: this.idOf('RightLeg') },
      //   { index: this.idOf('RightUpLeg') },
      //   // { index: this.idOf('Hips') },
      // ],
    }
  }

  getIKConfig(controlPoint: ControlPoint): IK {
    const effector = this.idOf(effectorBones[controlPoint])
    const target = this.idOf('Head')!
    // const target = this.targetBoneIds[controlPoint]
    const links = this.linksByControl[controlPoint] ?? []

    // debugger

    return { target, effector, links, iteration: 1 }
  }

  get skeleton() {
    return this.mesh.skeleton
  }

  get bones() {
    return this.skeleton.bones
  }

  get root() {
    return this.bones[0].parent!
  }

  boneOf(key: BoneKey) {
    return this.skeleton.getBoneByName(key)
  }

  idOf(name: BoneKey): number {
    return this.bones.findIndex((b) => name === b.name)
  }

  getInterpolatedTargets(
    control: ControlPoint,
    target: AxisPoint,
    steps = INTERPOLATE_STEPS,
  ): InterpolatedKeyframe[] {
    const frames: InterpolatedKeyframe[] = []

    const controlBone = this.boneOf(effectorBones[control])!

    // Local position and rotation for the control bone
    const controlPos = controlBone.position
    const controlRot = controlBone.quaternion

    // Determine the original axis points: forehead, neck, body.
    const refTargetBoneId = refAxisBones[target]

    const refTargetBone = this.boneOf(refTargetBoneId)!

    // Local position and rotation for the target bone
    const refTargetPos = refTargetBone.position
    const refTargetRot = refTargetBone.quaternion

    // The forehead should be a bit higher than the head.
    if (target === 'forehead') {
      refTargetPos.y += 0.1
    }

    for (let step = 0; step < steps; step++) {
      const t = step / steps
      const position = new Vector3()
      position.lerpVectors(controlPos, refTargetPos, t)

      const rotation = new Quaternion()
      rotation.slerpQuaternions(controlRot, refTargetRot, t)
      frames.push({ position, rotation, step })
    }

    return frames
  }

  private createTargetBone(point: ControlPoint, name: string) {
    const target = new Bone()
    target.position.set(50, 50, 50)

    target.visible = true
    target.name = name
    target.parent = this.root

    this.targetBoneIds[point as ControlPoint] = this.addBone(target)
  }

  updateSkeleton() {
    this.skeleton.update()
  }

  addBone(bone: Bone): number {
    bone.updateMatrixWorld(true)
    this.skeleton.bones.push(bone)

    // Add the inverse matrix of the bone
    this.mesh.skeleton.boneInverses.push(bone.matrixWorld.clone().invert())

    return this.bones.length - 1
  }

  valid(id: number | undefined | null) {
    return typeof id === 'number'
  }

  validate(iks: IK[]) {
    if (!iks) return false

    for (const ik of iks) {
      if (!this.valid(ik.target)) return false
      if (!this.valid(ik.effector)) return false

      for (const link of ik.links) {
        if (!this.valid(link.index)) return false
      }
    }

    return true
  }

  update(time: number) {
    this.waitFrames++

    // console.log('--- ok ---')

    // TODO: DEBUG - move this down!!!
    // Update all IK bones
    this.ik.update()

    if (this.waitFrames < this.maxWaitFrames) return
    this.waitFrames = 0

    // Update the interpolation keyframes.
    if (this.interpolating) {
      for (const _control in this.targetFrames) {
        const control = _control as ControlPoint

        const frameId = this.frameCounters[control]
        if (frameId === null) continue

        const keyframes = this.targetFrames[control]
        if (keyframes === null) continue

        const keyframe = keyframes[frameId]
        if (!keyframe) continue

        const targetBoneId = this.targetBoneIds[control]
        const bone = this.mesh.skeleton.bones[targetBoneId]

        // Copy the keyframe's position and rotation to the target bone.
        // bone.position.copy(keyframe.position)
        // bone.quaternion.copy(keyframe.rotation)

        this.frameCounters[control]!++

        // console.log(this.frameCounters[control])

        // TODO: decide how to handle the end of the interpolation
        if (this.frameCounters[control]! >= keyframes.length) {
          // this.frameCounters[control] = keyframes.length - 1
          // debugger

          // re-compute?
          this.frameCounters[control] = 0

          // this.targetFrames[control] = this.getInterpolatedTargets(
          //   control,
          //   TARGET_AXIS,
          // )
        }
      }

      console.log('-- ik update')
    }
  }

  clear() {
    this.ik.set([])
  }

  setPartMorph(config: AxisPointConfig) {
    const iks: IK[] = []

    // TODO: we must compute the closest target bone to the part

    for (const _part in config.parts) {
      const part = _part as AxisPointControlParts

      if (!config.parts[part]) {
        this.targetFrames[part] = null
        continue
      }

      // Define interpolated keyframes to move the target bone around.
      // ? should we run the same frames over and over, or freeze?
      // ? what happens after the morph ends?
      this.frameCounters[part] = 0
      // this.targetFrames[part] = this.getInterpolatedTargets(part, target)

      // Setup IK configuration
      const ik = this.getIKConfig(part)
      iks.push(ik)
    }

    // debugger

    this.ik.set(iks)
    this.interpolating = Object.values(this.targetFrames).some((s) => s)
  }

  public getMorphedPartIds(): number[] {
    return this.ik.iks.map((ik) => ik.effector)
  }
}
