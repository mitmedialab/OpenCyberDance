import { Group, Material, Scene, SkinnedMesh } from 'three'

export const dispose = (...scenes: (Scene | Group | null)[]) => {
  scenes.forEach((scene) => {
    if (!scene) return

    if ('traverse' in scene) {
      scene.traverse((o) => {
        if (o instanceof SkinnedMesh) {
          o.skeleton.dispose()
          o.geometry.dispose()

          if (o.material) {
            if (o.material.length) {
              for (let i = 0; i < o.material.length; ++i) {
                o.material[i].dispose()
              }
            } else {
              o.material.dispose()
            }
          }
        }

        if (o instanceof Material) {
          o.dispose()
        }
      })
    }
  })
}
