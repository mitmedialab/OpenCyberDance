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
      ],

      rightArm: [
        { index: this.idOf('RightForeArm') },
        { index: this.idOf('RightArm') },
      ],

      leftLeg: [
        { index: this.idOf('LeftLeg') },
        { index: this.idOf('LeftUpLeg') },
      ],

      rightLeg: [
        { index: this.idOf('RightLeg') },
        { index: this.idOf('RightUpLeg') },
      ],
    }
  }

  getIKConfig(controlPoint: ControlPoint, targetPoint: AxisPoint): IK {
    const effector = this.idOf(effectorBones[controlPoint])
    const target = this.targetBoneIds[targetPoint]
    const links = this.linksByControl[controlPoint] ?? []

    return { target, effector, links, iteration: 2 }
  }

  get bones() {
    return this.mesh.skeleton.bones
  }

  get root() {
    return this.bones[0].parent!
  }

  boneOf(key: BoneKey) {
    return this.bones.find((b) => b.name === key)
  }

  idOf(name: BoneKey): number {
    return this.bones.findIndex((b) => name === b.name)
  }

  getInterpolatedTargets(): InterpolatedTarget[] {
    const targets: InterpolatedTarget[] = []

    return targets
  }

  private createForeheadTargetBone() {
    const ref = this.boneOf('Head')
    if (!ref) return

    const target = new Bone()
    target.name = 'ForeheadTarget'
    target.visible = true

    ref.getWorldPosition(target.position)
    target.rotation.setFromQuaternion(ref.quaternion)
    target.position.y += 0.15

    return this.addBone(target)
  }

  private createNeckTargetBone() {
    const ref = this.boneOf('Neck')
    if (!ref) return

    const target = new Bone()
    target.name = 'NeckTarget'
    target.visible = true

    return this.addBone(target)
  }

  // ? we use the existing spine bone for now
  private createBodyCenterTargetBone() {
    const target = new Bone()
    target.name = 'BodyCenterTarget'
    target.visible = true

    return this.addBone(target)
  }

  // TODO: add the bone without adding it to the skeleton
  addBone(bone: Bone): number {
    this.mesh.add(bone)
    this.mesh.skeleton.update()

    return 0
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
    const target: AxisPoint = 'body'

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
