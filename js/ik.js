import THREE, {SkinnedMesh} from 'three'
import {CCDIKSolver} from '../jsm/animation/CCDIKSolver.js'

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

  setup() {
    this.selectMesh()

    const iks = [
      {
        target: this.bone('LeftLeg'),
        effector: this.bone('RightLeg'),
        links: [{index: this.bone('LeftUpLeg')}],
      },
    ]

    window.boneIds = this.skeleton.bones.map((b) => b.name)

    if (this.mesh) {
      this.ik = new CCDIKSolver(this.mesh, iks)
    }
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
}
