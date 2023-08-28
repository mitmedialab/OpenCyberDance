/** @param {THREE.Scene[]} scenes */
export const dispose = (...scenes) => {
  scenes.forEach((scene) => {
    if (!scene) return

    scene.traverse((o) => {
      if (o.geometry) {
        o.geometry.dispose()
      }

      if (o.material) {
        if (o.material.length) {
          for (let i = 0; i < o.material.length; ++i) {
            o.material[i].dispose()
          }
        } else {
          o.material.dispose()
        }
      }

      scene.remove(o)
    })
  })
}
