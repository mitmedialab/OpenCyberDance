import { SkinnedMesh } from 'three'
import { CCDIKSolver, IKS } from 'three/examples/jsm/animation/CCDIKSolver'

// import { BoneKey } from './bones'

// const axisPointBones = (bones: Bone[]) => {
//   const find = (key: BoneKey) => bones.find((b) => b.name === key)

//   return {
//     forehead() {
//       const ref = find('Head')
//     },

//     neck() {
//       const ref = find('Neck')
//     },

//     body() {
//       const ref = find('Spine')
//     },
//   }
// }

export class IKManager {
  ik: CCDIKSolver
  skeleton: THREE.SkeletonHelper
  model: THREE.Group
  mesh: THREE.SkinnedMesh

  constructor(skeleton: THREE.SkeletonHelper, model: THREE.Group) {
    this.skeleton = skeleton
    this.model = model

    let mesh: SkinnedMesh | null = null

    this.model.traverse((o) => {
      if (o instanceof SkinnedMesh) mesh = o
    })

    if (!mesh) throw new Error('No mesh found')

    this.mesh = mesh
    this.ik = new CCDIKSolver(this.mesh, [])
  }

  bone(name: string) {
    return this.skeleton.bones.findIndex((b) => name === b.name)
  }

  valid(id: number | undefined | null) {
    return typeof id === 'number'
  }

  validate(iks: IKS[]) {
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

  selectMesh() {}

  update() {
    // Update all IK bones
    this.ik.update()
  }

  set(iks: IKS[]) {
    if (!this.validate(iks)) {
      console.error('invalid IK definitions')
      return
    }

    // @ts-expect-error - ik.iks is private
    this.ik.iks = iks
  }

  clear() {
    this.set([])
  }
}
