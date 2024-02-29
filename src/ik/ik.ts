import {
  Bone,
  KeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three'

import { BoneKey } from '../bones'
import { AxisPointConfig } from '../overrides'
import { AxisPointControlParts, trackNameToPart } from '../parts'
import { CCDIKSolver, IK, IKLink } from './ccd-ik'

declare global {
  interface Window {
    axisPointManager: AxisPointManager
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

export class AxisPointManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh

  /**
   * ? How long to wait before updating the IK solver.
   */
  public maxWaitFrames = 2

  waitFrames = 0

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

    // ! for debugging
    window.axisPointManager = this
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

    return { target, effector, links, iteration: 10 }
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

  tick() {
    // this.syncTargetBonePosition()
  }

  /**
   * Apply the pre-computed position and rotation keyframes of target bones.
   *
   * This will interpolate the target bone's position until it reaches the desired axis point.
   */
  syncTargetBonePosition() {
    // Do not update the interpolation keyframes if we are NOT interpolating
    if (!this.interpolating) return

    // update the wait counter to avoid updating the IK too often
    this.waitFrames++
    if (this.waitFrames < this.maxWaitFrames) return
    this.waitFrames = 0

    console.log(`ik: updating ik to match interpolated targets`)

    for (const _control in this.targetFrames) {
      const control = _control as ControlPoint

      const frameId = this.frameCounters[control]
      if (frameId === null) continue

      const keyframes = this.targetFrames[control]
      if (keyframes === null) continue

      const keyframe = keyframes[frameId]
      if (!keyframe) continue

      const { step } = keyframe
      console.log(`ik: ${control} target at step ${step}`)

      this.setTargetBonePlacement(control, keyframe.position, keyframe.rotation)

      // Update the frame counter for keyframes interpolation.
      this.frameCounters[control]!++

      // TODO: decide how to handle the end of the interpolation
      if (this.frameCounters[control]! >= keyframes.length) {
        this.frameCounters[control] = keyframes.length - 1
      }
    }

    // Update all IK bones
    this.ik.update()
  }

  setTargetBonePlacement(
    control: ControlPoint,
    position: Vector3,
    rotation: Quaternion,
  ) {
    const targetBoneId = this.targetBoneIds[control]
    const bone = this.mesh.skeleton.bones[targetBoneId]

    bone.position.copy(position)
    bone.quaternion.copy(rotation)
  }

  clear() {
    this.ik.set([])
  }

  applyAxisPointConfig(config: AxisPointConfig) {
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

      const keyframes = this.getInterpolatedTargets(part, target, 5)
      this.targetFrames[part] = keyframes

      // Setup IK configuration
      const ik = this.getIKConfig(part)
      iks.push(ik)

      console.log(`ik: part configured for ${part}`, { ik, keyframes })
    }

    this.ik.set(iks)
    this.interpolating = Object.values(this.targetFrames).some((s) => s)
  }

  public getMorphedPartIds(): number[] {
    return this.ik.iks.map((ik) => ik.effector)
  }

  /**
   * Freezes the animation track at a specific point in time.
   * This effectively disables the current animation from playing.
   *
   * This is so we can let the IK solver interpolate the movement,
   * without interference from current animation.
   */
  public freezeTrack(track: KeyframeTrack, config: AxisPointConfig, time = 1) {
    const { parts } = config

    const part = trackNameToPart(track.name, 'axis')
    if (!part) return

    const enabled = parts[part as AxisPointControlParts]
    if (!enabled) return

    // console.debug(`ik: froze ${track.name} at ${part} axis point`)

    // Freeze the rotation keyframes
    if (track instanceof QuaternionKeyframeTrack) {
      const size = track.getValueSize()
      if (size !== 4) throw new Error('invalid quaternion track')

      const len = track.times.length - 1
      const frame = Math.round((time / track.times[len]) * len)
      const data = track.values.slice(frame * size, frame * size + size)

      const [x, y, z, w] = data
      if (data.length !== 4) throw new Error('invalid data length')

      // Modify the entire keyframe values to this moment in time.
      for (let i = 0; i < track.values.length; i += size) {
        track.values[i] = x
        track.values[i + 1] = y
        track.values[i + 2] = z
        track.values[i + 3] = w
      }
    }

    // Freeze the position keyframes
    if (
      track instanceof VectorKeyframeTrack &&
      track.name.includes('position')
    ) {
      const size = track.getValueSize()
      if (size !== 3) throw new Error('invalid position track')

      const len = track.times.length - 1
      const frame = Math.round((time / track.times[len]) * len)
      const data = track.values.slice(frame * size, frame * size + size)

      const [x, y, z] = data
      if (data.length !== 3) throw new Error('invalid data length')

      // Modify the entire keyframe values to this moment in time.
      for (let i = 0; i < track.values.length; i += size) {
        track.values[i] = x
        track.values[i + 1] = y
        track.values[i + 2] = z
      }
    }
  }

  debugApply(
    controls: ControlPoint[],
    position: [number, number, number],
    rotation: [number, number, number, number],
  ) {
    for (const control of controls) {
      this.setTargetBonePlacement(
        control,
        new Vector3(...position),
        new Quaternion(...rotation),
      )
    }

    const iks = controls.map((control) => this.getIKConfig(control))
    console.log(`iks length: ${iks.length}`)

    this.ik.set(iks)
    this.ik.update()
  }
}
