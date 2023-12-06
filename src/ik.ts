import { Bone, SkinnedMesh } from 'three'
import { CCDIKSolver, IKS } from 'three/examples/jsm/animation/CCDIKSolver'

import { BoneKey } from './bones'

// import { BoneKey } from './bones'

declare global {
  interface Window {
    axisBone: ReturnType<typeof createAxisPointBones>
  }
}

const createAxisPointBones = (bones: Bone[]) => {
  const find = (key: BoneKey) => bones.find((b) => b.name === key)

  return {
    forehead() {
      const ref = find('Head')
      if (!ref) return

      ref.visible = true

      // TODO: tweak target forehead bone
      const fore = new Bone()
      fore.position.set(ref.position.x, ref.position.y, ref.position.z)
      fore.rotation.set(ref.rotation.x, ref.rotation.y, ref.rotation.z, 'XYZ')

      return fore
    },

    neck() {
      const ref = find('Neck')
      if (!ref) return
    },

    body() {
      const ref = find('Spine')
    },
  }
}

export class IKManager {
  ik: CCDIKSolver
  mesh: SkinnedMesh

  constructor(mesh: SkinnedMesh) {
    this.mesh = mesh
    this.ik = new CCDIKSolver(this.mesh, [])

    const axisBone = createAxisPointBones(this.mesh.skeleton.bones)
    window.axisBone = axisBone
  }

  bone(name: string) {
    return this.mesh.skeleton.bones.findIndex((b) => name === b.name)
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
