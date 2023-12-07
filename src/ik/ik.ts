import { Bone, SkinnedMesh, Vector3 } from 'three'

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

export type AxisBones = Record<AxisPoint, Bone>
export type ControlBones = Record<ControlPoint, Bone>

const effectorBones: Record<ControlPoint, BoneKey> = {
  leftArm: 'LeftHand',
  rightArm: 'RightHand',
  leftLeg: 'LeftFoot',
  rightLeg: 'RightFoot',
}

const targetBones: Record<AxisPoint, BoneKey> = {
  // TODO: change to "forehead"
  forehead: 'Head',

  neck: 'Neck',
  body: 'Spine1',
}

export class IKManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh
  axisBones: AxisBones

  constructor(mesh: SkinnedMesh) {
    this.mesh = mesh

    this.axisBones = {
      forehead: this.createForeheadBone()!,
      neck: this.createNeckBone()!,
      body: this.createBodyCenterBone()!,
    }

    this.ik = new CCDIKSolver(this.mesh, [])

    window.ikManager = this
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
    const target = this.idOf(targetBones[targetPoint])
    const links = this.linksByControl[controlPoint] ?? []

    return { target, effector, links }
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

  createForeheadBone() {
    const ref = this.boneOf('Head')
    if (!ref) return

    const fore = new Bone()
    fore.visible = true

    ref.getWorldPosition(fore.position)
    fore.rotation.setFromQuaternion(ref.quaternion)
    fore.position.y += 0.15

    return fore
  }

  // ? we use the existing neck bone for now
  createNeckBone() {
    return this.boneOf('Neck')
  }

  addBone(bone: Bone) {
    // TODO: this crashes skeleton.update()
    // this.mesh.skeleton.bones.push(bone)

    this.mesh.add(bone)
    this.mesh.skeleton.update()
  }

  // ? we use the existing spine bone for now
  createBodyCenterBone() {
    return this.boneOf('Spine1')
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

    for (const _part in config.parts) {
      const part = _part as AxisPointControlParts
      if (!config.parts[part]) continue

      const ik = this.getIKConfig(part, 'body')
      iks.push(ik)
    }

    this.set(iks)
  }

  public getMorphedPartIds(): number[] {
    return this.ik.iks.map((ik) => ik.effector)
  }
}
