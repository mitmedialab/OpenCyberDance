// -- WIP --

function debugAddPointClouds(tracks) {
  // Clear existing objects.
  if (points) {
    points.traverse((obj) => points.remove(obj))
    scene.remove(points)
  }

  const times = analyzer.times

  if (times.length === 0) {
    console.warn('analyzer cannot find any keyframes!')
    return
  }

  const geometry = new THREE.BufferGeometry()

  const V_SIZE = 3
  const positions = new Float32Array(times.length * V_SIZE)

  times.forEach((time) => {
    const keyframes = analyzer.getKeyframesAtTime(time)

    keyframes.forEach((part, i) => {
      const v = part.value.v
      // const bone = model.getObjectByName(toBone(part.track))

      if (v instanceof THREE.Vector3) {
        positions[i] = v.x
        positions[i + 1] = v.y
        positions[i + 2] = v.z
      }

      // TODO: we can't do this because rotations cannot be plotted as positions.
      // if (v instanceof THREE.Quaternion) {
      //   const r = bone.rotation.clone().setFromQuaternion(v)
      //   positions[i] = r.x
      //   positions[i + 1] = r.y
      //   positions[i + 2] = r.z
      // }
    })
  })

  console.log(`> adding ${times.length} point clouds`)

  // const sprite = new THREE.TextureLoader().load('disc.png')
  // sprite.colorSpace = THREE.SRGBColorSpace

  const attribute = new THREE.BufferAttribute(positions, V_SIZE)
  geometry.setAttribute('position', attribute)

  const material = new THREE.PointsMaterial({
    size: 0.1,
    alphaTest: 0.2,
    transparent: true,
  })

  material.color.setHSL(0.5, Math.random(), Math.random(), THREE.SRGBColorSpace)

  points = new THREE.Points(geometry, material)
  scene.add(points)
}
