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
interface InterpolatedTarget {
  position: Vector3
  rotation: Quaternion
  time: number
}

const effectorBones: Record<ControlPoint, BoneKey> = {
  leftArm: 'LeftHand',
  rightArm: 'RightHand',
  leftLeg: 'LeftFoot',
  rightLeg: 'RightFoot',
}

export class IKManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh

  targetBoneIds: Record<AxisPoint, number> = {
    forehead: -1,
    neck: -1,
    body: -1,
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
    this.createForeheadTargetBone()
    this.createNeckTargetBone()
    this.createBodyCenterTargetBone()
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

  getIKConfig(controlPoint: ControlPoint, targetPoint: AxisPoint): IK {
    const effector = this.idOf(effectorBones[controlPoint])
    const target = this.targetBoneIds[targetPoint]
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

  getInterpolatedTargets(): InterpolatedTarget[] {
    const targets: InterpolatedTarget[] = []

    return targets
  }

  private createForeheadTargetBone() {
    const target = this.createBoneFromRef('Head')
    if (!target) return

    target.position.y += 0.15
    target.name = 'ForeheadTarget'

    this.targetBoneIds.forehead = this.addBone(target)
  }

  private createNeckTargetBone() {
    const target = this.createBoneFromRef('Neck')
    if (!target) return

    target.name = 'NeckTarget'

    this.targetBoneIds.neck = this.addBone(target)
  }

  private createBodyCenterTargetBone() {
    const target = this.createBoneFromRef('Spine1')
    if (!target) return

    target.name = 'BodyCenterTarget'

    this.targetBoneIds.body = this.addBone(target)
  }

  createBoneFromRef(refKey: BoneKey) {
    const ref = this.boneOf(refKey)
    if (!ref) return

    const target = new Bone()
    target.visible = true

    ref.getWorldPosition(target.position)
    target.rotation.setFromQuaternion(ref.quaternion)
    target.parent = this.root.parent

    return target
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

    console.debug('Valid IK definitions')

    return true
  }

  update() {
    // Update all IK bones
    this.ik.update()
  }

  set(iks: IK[]) {
    this.ik.set(iks)
  }

  clear() {
    this.set([])
  }

  setPartMorph(config: AxisPointConfig) {
    const iks: IK[] = []

    // TODO: we must compute the closest target bone to the part
    const target: AxisPoint = 'forehead'

    for (const _part in config.parts) {
      const part = _part as AxisPointControlParts
      if (!config.parts[part]) continue

      const ik = this.getIKConfig(part, target)
      iks.push(ik)
    }

    this.set(iks)
  }

  public getMorphedPartIds(): number[] {
    return this.ik.iks.map((ik) => ik.effector)
  }
}
