import * as THREE from 'three'
import { SkinnedMesh } from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

import { BoneKey } from './bones.js'

/** @param {THREE.Bone[]} bones */
const axisPointBones = (bones) => {
  /** @param {BoneKeys} key */
  const find = (key) => bones.find((b) => b.name === key)

  return {
    forehead() {
      const ref = find(BoneKey.Head)
    },

    neck() {
      const ref = find(BoneKey.Neck)
    },

    body() {
      const ref = find(BoneKey.Spine)
    },
  }
}

export class IKManager {
  /** @type {CCDIKSolver} */
  ik

  /** @type {THREE.SkeletonHelper} */
  skeleton

  /** @type {THREE.Scene} */
  model

  /** @type {THREE.SkinnedMesh} */
  mesh

  /**
   * @param {THREE.SkeletonHelper} skeleton
   * @param {THREE.Scene} model
   */
  constructor(skeleton, model) {
    this.skeleton = skeleton
    this.model = model
    this.setup()
  }

  /**
   * @param {string} name
   */
  bone(name) {
    return this.skeleton.bones.findIndex((b) => name === b.name)
  }

  valid(id) {
    if (id === -1) return false

    return typeof id === 'number'
  }

  setup() {
    this.selectMesh()

    window.boneIds = this.skeleton.bones.map((b) => b.name)

    if (this.mesh) {
      this.ik = new CCDIKSolver(this.mesh, [])
    }
  }

  validate(iks) {
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

  selectMesh() {
    this.model.traverse((o) => {
      if (o instanceof SkinnedMesh) this.mesh = o
    })
  }

  update() {
    // Update all IK bones
    this.ik.update()
  }

  /**
   * @param {Object[]} iks
   */
  set(iks) {
    if (!this.validate(iks)) {
      console.error('invalid IK definitions')
      return
    }

    this.ik.iks = iks
  }

  clear() {
    this.set([])
  }
}
