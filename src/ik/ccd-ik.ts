import { Bone, Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three'

import { CCDIKHelper } from './ccd-ik-helper'

export interface IKLink {
  enabled?: boolean | undefined
  index: number
  limitation?: Vector3
  rotationMin?: Vector3
  rotationMax?: Vector3
}

export interface IK {
  effector: number
  iteration?: number | undefined
  links: IKLink[]
  minAngle?: number | undefined
  maxAngle?: number | undefined
  target: number
}

const _q = new Quaternion()
const _targetPos = new Vector3()
const _targetVec = new Vector3()
const _effectorPos = new Vector3()
const _effectorVec = new Vector3()
const _linkPos = new Vector3()
const _invLinkQ = new Quaternion()
const _linkScale = new Vector3()
const _axis = new Vector3()
const _vector = new Vector3()
export const _matrix = new Matrix4()

/**
 * CCD Algorithm
 *  - https://sites.google.com/site/auraliusproject/ccd-algorithm
 *
 * ik parameter example
 *
 * target, effector, index in links are bone index in skeleton.bones.
 * the bones relation should be
 * <-- parent                                  child -->
 * links[ n ], links[ n - 1 ], ..., links[ 0 ], effector
 *
 * iks = [ {
 *	target: 1,
 *	effector: 2,
 *	links: [ { index: 5, limitation: new Vector3( 1, 0, 0 ) }, { index: 4, enabled: false }, { index : 3 } ],
 *	iteration: 10,
 *	minAngle: 0.0,
 *	maxAngle: 1.0,
 * } ];
 */

export class CCDIKSolver {
  mesh: SkinnedMesh
  iks: IK[] = []

  constructor(mesh: SkinnedMesh, iks: IK[] = []) {
    this.mesh = mesh
    this.set(iks)
  }

  public set(iks: IK[]) {
    this.iks = iks

    this.validate()
  }

  public update() {
    for (const ik of this.iks) {
      this.updateOne(ik)
    }
  }

  public updateOne(ik: IK) {
    const bones = this.mesh.skeleton.bones

    // for reference overhead reduction in loop
    const math = Math

    const effector = bones[ik.effector]
    const target = bones[ik.target]

    // don't use getWorldPosition() here for the performance
    // because it calls updateMatrixWorld( true ) inside.
    _targetPos.setFromMatrixPosition(target.matrixWorld)

    const links = ik.links
    const iteration = ik.iteration !== undefined ? ik.iteration : 1

    for (let i = 0; i < iteration; i++) {
      let rotated = false

      for (let j = 0, jl = links.length; j < jl; j++) {
        const linkConfig = links[j]
        const link = bones[linkConfig.index]

        // skip this link and following links.
        // this skip is used for MMD performance optimization.
        if (linkConfig.enabled === false) break

        const limitation = linkConfig.limitation
        const rotationMin = linkConfig.rotationMin
        const rotationMax = linkConfig.rotationMax

        // don't use getWorldPosition/Quaternion() here for the performance
        // because they call updateMatrixWorld( true ) inside.
        link.matrixWorld.decompose(_linkPos, _invLinkQ, _linkScale)
        _invLinkQ.invert()
        _effectorPos.setFromMatrixPosition(effector.matrixWorld)

        // work in link world
        _effectorVec.subVectors(_effectorPos, _linkPos)
        _effectorVec.applyQuaternion(_invLinkQ)
        _effectorVec.normalize()

        _targetVec.subVectors(_targetPos, _linkPos)
        _targetVec.applyQuaternion(_invLinkQ)
        _targetVec.normalize()

        let angle = _targetVec.dot(_effectorVec)

        if (angle > 1.0) {
          angle = 1.0
        } else if (angle < -1.0) {
          angle = -1.0
        }

        angle = math.acos(angle)

        // skip if changing angle is too small to prevent vibration of bone
        if (angle < 1e-5) continue

        if (ik.minAngle !== undefined && angle < ik.minAngle) {
          angle = ik.minAngle
        }

        if (ik.maxAngle !== undefined && angle > ik.maxAngle) {
          angle = ik.maxAngle
        }

        _axis.crossVectors(_effectorVec, _targetVec)
        _axis.normalize()

        _q.setFromAxisAngle(_axis, angle)
        link.quaternion.multiply(_q)

        // TODO: re-consider the limitation specification
        if (limitation !== undefined) {
          let c = link.quaternion.w

          if (c > 1.0) c = 1.0

          const c2 = math.sqrt(1 - c * c)
          link.quaternion.set(
            limitation.x * c2,
            limitation.y * c2,
            limitation.z * c2,
            c,
          )
        }

        if (rotationMin !== undefined) {
          link.rotation.setFromVector3(
            _vector.setFromEuler(link.rotation).max(rotationMin),
          )
        }

        if (rotationMax !== undefined) {
          link.rotation.setFromVector3(
            _vector.setFromEuler(link.rotation).min(rotationMax),
          )
        }

        link.updateMatrixWorld(true)

        rotated = true
      }

      if (!rotated) break
    }

    return this
  }

  public createHelper() {
    return new CCDIKHelper(this.mesh, this.iks)
  }

  private validate() {
    const iks = this.iks
    const bones = this.mesh.skeleton.bones

    for (let i = 0, il = iks.length; i < il; i++) {
      const ik = iks[i]
      const effector = bones[ik.effector]
      const links = ik.links
      let link0, link1

      link0 = effector

      for (let j = 0, jl = links.length; j < jl; j++) {
        link1 = bones[links[j].index]

        if (link0.parent !== link1) {
          console.warn(
            'THREE.CCDIKSolver: bone ' +
              link0.name +
              ' is not the child of bone ' +
              link1.name,
          )
        }

        link0 = link1
      }
    }
  }
}

export function getPosition(bone: Bone, matrixWorldInv: Matrix4) {
  return _vector
    .setFromMatrixPosition(bone.matrixWorld)
    .applyMatrix4(matrixWorldInv)
}

export function setPositionOfBoneToAttributeArray(
  array: number[],
  index: number,
  bone: Bone,
  matrixWorldInv: Matrix4,
) {
  const v = getPosition(bone, matrixWorldInv)

  array[index * 3 + 0] = v.x
  array[index * 3 + 1] = v.y
  array[index * 3 + 2] = v.z
}
