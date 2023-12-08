import { Bone, Quaternion, SkinnedMesh, Vector3 } from 'three'

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
  leftLeg: 'LeftFoot',
  rightLeg: 'RightFoot',
}

const refAxisBones: Record<AxisPoint, BoneKey> = {
  forehead: 'Head',
  neck: 'Neck',
  body: 'Spine1',
}

export class IKManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh

  waitFrames = 0
  maxWaitFrames = 10

  private interpolating = false

  frameCounters: Record<ControlPoint, number | null> = {
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
  }

  targetFrames: Record<ControlPoint, InterpolatedKeyframe[] | null> = {
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
  }

  // The target bones are not part of the original skeleton.
  // They are created dynamically to be used as moving targets for the IK solver.
  targetBoneIds: Record<ControlPoint, number> = {
    leftArm: -1,
    rightArm: -1,
    leftLeg: -1,
    rightLeg: -1,
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
    this.createTargetBone('leftLeg', 'LeftLegTarget')
    this.createTargetBone('rightArm', 'RightArmTarget')
    this.createTargetBone('rightLeg', 'RightLegTarget')
  }

  get linksByControl(): Record<ControlPoint, IKLink[]> {
    return {
      leftArm: [
        { index: this.idOf('LeftForeArm') },
        { index: this.idOf('LeftArm') },
        // { index: this.idOf('LeftShoulder') },
        // { index: this.idOf('Spine2') },
      ],

      rightArm: [
        { index: this.idOf('RightForeArm') },
        { index: this.idOf('RightArm') },
        // { index: this.idOf('RightShoulder') },
        // { index: this.idOf('Spine2') },
      ],

      leftLeg: [
        { index: this.idOf('LeftLeg') },
        { index: this.idOf('LeftUpLeg') },
        // { index: this.idOf('Hips') },
      ],

      rightLeg: [
        { index: this.idOf('RightLeg') },
        { index: this.idOf('RightUpLeg') },
        // { index: this.idOf('Hips') },
      ],
    }
  }

  getIKConfig(controlPoint: ControlPoint): IK {
    const effector = this.idOf(effectorBones[controlPoint])
    const target = this.targetBoneIds[controlPoint]
    const links = this.linksByControl[controlPoint] ?? []

    return { target, effector, links, iteration: 3 }
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
    steps = 10,
  ): InterpolatedKeyframe[] {
    const frames: InterpolatedKeyframe[] = []

    const controlBone = this.boneOf(effectorBones[control])!
    const controlPos = new Vector3()
    const controlRot = controlBone.quaternion.clone()
    controlBone.getWorldPosition(controlPos)

    // Determine the original axis points: forehead, neck, body.
    const refTargetBoneId = refAxisBones[target]
    const refTargetBone = this.boneOf(refTargetBoneId)!
    const refTargetPos = new Vector3()
    const refTargetRot = refTargetBone.quaternion.clone()
    refTargetBone.getWorldPosition(refTargetPos)

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
    target.visible = true
    target.name = name
    target.parent = this.root.parent

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

        bone.position.copy(keyframe.position)
        bone.quaternion.copy(keyframe.rotation)

        this.frameCounters[control]!++

        // TODO: decide how to handle the end of the interpolation
        if (this.frameCounters[control]! >= keyframes.length) {
          this.frameCounters[control] = keyframes.length - 1
        }
      }

      // Update all IK bones
      this.ik.update()
    }
  }

  clear() {
    this.ik.set([])
  }

  setPartMorph(config: AxisPointConfig) {
    const iks: IK[] = []

    // TODO: we must compute the closest target bone to the part
    const target: AxisPoint = 'forehead'

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
      this.targetFrames[part] = this.getInterpolatedTargets(part, target)

      // Setup IK configuration
      const ik = this.getIKConfig(part)
      iks.push(ik)
    }

    this.ik.set(iks)
    this.interpolating = Object.values(this.targetFrames).some((s) => s)
  }

  public getMorphedPartIds(): number[] {
    return this.ik.iks.map((ik) => ik.effector)
  }
}
