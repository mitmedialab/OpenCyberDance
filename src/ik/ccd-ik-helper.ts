import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SkinnedMesh,
  SphereGeometry,
} from 'three'

import {
  _matrix,
  getPosition,
  IKS,
  setPositionOfBoneToAttributeArray,
} from './ccd-ik'

/**
 * Visualize IK bones
 */

export class CCDIKHelper extends Object3D {
  root: SkinnedMesh
  iks: IKS[]
  sphereGeometry: SphereGeometry
  targetSphereMaterial: MeshBasicMaterial
  effectorSphereMaterial: MeshBasicMaterial
  linkSphereMaterial: MeshBasicMaterial
  lineMaterial: LineBasicMaterial

  constructor(mesh: SkinnedMesh, iks: IKS[] = [], sphereSize = 0.25) {
    super()

    this.root = mesh
    this.iks = iks

    this.matrix.copy(mesh.matrixWorld)
    this.matrixAutoUpdate = false

    this.sphereGeometry = new SphereGeometry(sphereSize, 16, 8)

    this.targetSphereMaterial = new MeshBasicMaterial({
      color: new Color(16746632),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    this.effectorSphereMaterial = new MeshBasicMaterial({
      color: new Color(8978312),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    this.linkSphereMaterial = new MeshBasicMaterial({
      color: new Color(8947967),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    this.lineMaterial = new LineBasicMaterial({
      color: new Color(16711680),
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    this._init()
  }

  /**
   * Updates IK bones visualization.
   */
  updateMatrixWorld(force: boolean | undefined) {
    const mesh = this.root

    if (this.visible) {
      let offset = 0

      const iks = this.iks
      const bones = mesh.skeleton.bones

      _matrix.copy(mesh.matrixWorld).invert()

      for (let i = 0, il = iks.length; i < il; i++) {
        const ik = iks[i]

        const targetBone = bones[ik.target]
        const effectorBone = bones[ik.effector]

        const targetMesh = this.children[offset++]
        const effectorMesh = this.children[offset++]

        targetMesh.position.copy(getPosition(targetBone, _matrix))
        effectorMesh.position.copy(getPosition(effectorBone, _matrix))

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link = ik.links[j]
          const linkBone = bones[link.index]

          const linkMesh = this.children[offset++]

          linkMesh.position.copy(getPosition(linkBone, _matrix))
        }

        const line = this.children[offset++]

        // @ts-expect-error - to fix
        const array = line.geometry.attributes.position.array

        setPositionOfBoneToAttributeArray(array, 0, targetBone, _matrix)
        setPositionOfBoneToAttributeArray(array, 1, effectorBone, _matrix)

        for (let j = 0, jl = ik.links.length; j < jl; j++) {
          const link = ik.links[j]
          const linkBone = bones[link.index]
          setPositionOfBoneToAttributeArray(array, j + 2, linkBone, _matrix)
        }

        // @ts-expect-error - to fix
        line.geometry.attributes.position.needsUpdate = true
      }
    }

    this.matrix.copy(mesh.matrixWorld)

    super.updateMatrixWorld(force)
  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this method whenever this instance is no longer used in your app.
   */
  dispose() {
    this.sphereGeometry.dispose()

    this.targetSphereMaterial.dispose()
    this.effectorSphereMaterial.dispose()
    this.linkSphereMaterial.dispose()
    this.lineMaterial.dispose()

    const children = this.children

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      // @ts-expect-error - to fix
      if (child.isLine) child.geometry.dispose()
    }
  }

  // private method
  _init() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this
    const iks = this.iks

    function createLineGeometry(ik: IKS) {
      const geometry = new BufferGeometry()
      const vertices = new Float32Array((2 + ik.links.length) * 3)
      geometry.setAttribute('position', new BufferAttribute(vertices, 3))

      return geometry
    }

    function createTargetMesh() {
      return new Mesh(scope.sphereGeometry, scope.targetSphereMaterial)
    }

    function createEffectorMesh() {
      return new Mesh(scope.sphereGeometry, scope.effectorSphereMaterial)
    }

    function createLinkMesh() {
      return new Mesh(scope.sphereGeometry, scope.linkSphereMaterial)
    }

    function createLine(ik: IKS) {
      return new Line(createLineGeometry(ik), scope.lineMaterial)
    }

    for (let i = 0, il = iks.length; i < il; i++) {
      const ik = iks[i]

      this.add(createTargetMesh())
      this.add(createEffectorMesh())

      for (let j = 0, jl = ik.links.length; j < jl; j++) {
        this.add(createLinkMesh())
      }

      this.add(createLine(ik))
    }
  }
}
