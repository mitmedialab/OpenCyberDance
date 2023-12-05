import { Group, Mesh, Scene } from 'three'

export const dispose = (...scenes: (Scene | Group | null)[]) => {
  scenes.forEach((scene) => {
    if (!scene) return

    if ('traverse' in scene) {
      scene.traverse((o) => {
        if (o instanceof Mesh) {
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
      })
    }
  })
}
