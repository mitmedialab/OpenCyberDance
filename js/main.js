import * as THREE from 'three'
import Stats from 'three/addons/libs/stats.module.js'
import {GUI} from 'three/addons/libs/lil-gui.module.min.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

let scene, renderer, camera, stats, gltf
let model, skeleton, mixer, clock

const crossFadeControls = []

let currentBaseAction = 'idle'
const allActions = []
const baseActions = {
  // idle: {weight: 1},
  // dance_flair: {weight: 0},
  // hiphop_1: {weight: 0},
  // hiphop_2: {weight: 0},
  // hiphop_3: {weight: 0},
  // silly: {weight: 0},
  // salsa: {weight: 0},
  // roomba: {weight: 0},
  // Maraschino: {weight: 0},
  // situp: {weight: 0},
  // cs_leftHand: {weight: 0},
  'take60_..004': {weight: 0},
}
const additiveActions = {
  // sitting: {weight: 0},
  // laidback: {weight: 0},
  // jumping_jack: {weight: 0},
  // fallforward: {weight: 0},
  // fallback: {weight: 0},
  // falling: {weight: 0},
}

let panelSettings, numAnimations
let baseAnimationTracks = []

init()

function setAnimationTrack(tracks) {
  tracks
    // .filter((t) => /Hand|Arm/.test(t.name))
    .forEach((track, ti) => {
      const valueSize = track.getValueSize()

      track.times.forEach((time, i) => {
        const valueOffset = i * valueSize

        const quaternion = new THREE.Quaternion().fromArray(
          track.values,
          valueOffset
        )

        const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')

        const originalEuler = baseAnimationTracks[ti][i]

        euler.x = originalEuler.x
        euler.y = originalEuler.y
        euler.z = originalEuler.z

        // // Amplify Euler angles
        euler.x *= rotationSettings.X
        euler.y *= rotationSettings.Y
        euler.z *= rotationSettings.Z

        // Convert back to quaternion
        quaternion.setFromEuler(euler)

        // Update track values
        quaternion.toArray(track.values, valueOffset)
      })

      // track.values = track.values.map((v, i) => {
      //   // if (t.constructor.name.includes('Vector')) {
      //   //   return v
      //   // }
      //   // if (i === 0) return v * 5
      //   // if (i === t.values.length - 4) return v * 5

      //   // debugger

      //   return v
      // })
    })
}

function init() {
  const container = document.getElementById('container')
  clock = new THREE.Clock()

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xdedede)
  scene.fog = new THREE.Fog(0xdedede, 10, 50)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfefefe, 4)
  hemiLight.position.set(0, 20, 0)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 4)
  dirLight.position.set(3, 10, 10)
  dirLight.castShadow = true
  dirLight.shadow.camera.top = 2
  dirLight.shadow.camera.bottom = -2
  dirLight.shadow.camera.left = -2
  dirLight.shadow.camera.right = 2
  dirLight.shadow.camera.near = 0.1
  dirLight.shadow.camera.far = 40
  scene.add(dirLight)

  // ground

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({color: 0xcbcbcb, depthWrite: false})
  )

  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  scene.add(mesh)

  const loader = new GLTFLoader()

  loader.load('humanPPtesting.glb', (gltf) => {
    model = gltf.scene
    scene.add(model)

    model.traverse(function (object) {
      if (object.isMesh) object.castShadow = true
    })

    const s = 0.008
    model.scale.set(s, s, s)
    model.position.set(0, 0, -0.5)
    // console.log(model)

    skeleton = new THREE.SkeletonHelper(model)
    skeleton.visible = false
    scene.add(skeleton)

    const animations = gltf.animations

    animations[0].tracks.forEach((track) => {
      const eulers = []

      const valueSize = track.getValueSize()

      track.times.forEach((time, i) => {
        const valueOffset = i * valueSize

        const quaternion = new THREE.Quaternion().fromArray(
          track.values,
          valueOffset
        )

        const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
        eulers.push(euler)
      })

      baseAnimationTracks.push(eulers)
    })

    // const tracks = gltf.animations[0].tracks.filter(
    //   // (t) => /Leg|Foot|Toe/.test(t.name) && !t.name.includes('scale')
    //   // t.constructor.name.includes('Vector') &&
    //   (t) => t
    // )

    mixer = new THREE.AnimationMixer(model)

    numAnimations = animations.length

    for (let i = 0; i !== numAnimations; ++i) {
      let clip = animations[i]

      const name = clip.name
      console.log('clipName', name)

      if (baseActions[name]) {
        const action = mixer.clipAction(clip)
        activateAction(action)
        baseActions[name].action = action
        allActions.push(action)
      } else if (additiveActions[name]) {
        // Make the clip additive and remove the reference frame
        THREE.AnimationUtils.makeClipAdditive(clip)

        if (clip.name.endsWith('_pose')) {
          clip = THREE.AnimationUtils.subclip(clip, clip.name, 2, 3, 30)
        }

        const action = mixer.clipAction(clip)
        activateAction(action)
        additiveActions[name].action = action
        allActions.push(action)
      }
    }

    createPanel()

    animate()
  })

  renderer = new THREE.WebGLRenderer({antialias: true})
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.useLegacyLights = false
  container.appendChild(renderer.domElement)

  // camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    100
  )
  camera.position.set(-1, 2, 3)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableZoom = false
  controls.target.set(0, 1, 0)
  controls.update()

  stats = new Stats()
  container.appendChild(stats.dom)

  window.addEventListener('resize', onWindowResize)
}

const rotationSettings = {X: 1.0, Y: 1.0, Z: 1.0}

function createPanel() {
  const panel = new GUI({width: 310})

  const folder1 = panel.addFolder('Base Actions')
  const folder2 = panel.addFolder('Additive Action Weights')
  const folder3 = panel.addFolder('General Speed')
  const folder4 = panel.addFolder('All Rotations')

  function alterRotation() {
    // setAnimationTrack(baseActions['take60_..004'].action._clip.tracks)
    setAnimationTrack(baseActions['take60_..004'].action._clip.tracks)
  }

  folder4.add(rotationSettings, 'X', 1, 10).listen().onChange(alterRotation)
  folder4.add(rotationSettings, 'Y', 1, 10).listen().onChange(alterRotation)
  folder4.add(rotationSettings, 'Z', 1, 10).listen().onChange(alterRotation)

  panelSettings = {
    'modify time scale': 1.0,
  }

  const baseNames = ['None', ...Object.keys(baseActions)]

  for (let i = 0, l = baseNames.length; i !== l; ++i) {
    const name = baseNames[i]
    const settings = baseActions[name]

    // handler
    panelSettings[name] = function () {
      const currentSettings = baseActions[currentBaseAction]
      const currentAction = currentSettings ? currentSettings.action : null
      const action = settings ? settings.action : null

      if (currentAction !== action) {
        console.log('pcf', {currentAction, action, settings, name})
        prepareCrossFade(currentAction, action, 0.35)
      }
    }

    crossFadeControls.push(folder1.add(panelSettings, name))
  }

  for (const name of Object.keys(additiveActions)) {
    const settings = additiveActions[name]

    panelSettings[name] = settings.weight
    folder2
      .add(panelSettings, name, 0.0, 1.0, 0.01)
      .listen()
      .onChange(function (weight) {
        setWeight(settings.action, weight)
        settings.weight = weight
      })
  }

  folder3
    .add(panelSettings, 'modify time scale', 0.0, 1.5, 0.01)
    .onChange(modifyTimeScale)

  folder1.open()
  folder2.open()
  folder3.open()
  folder4.open()

  crossFadeControls.forEach(function (control) {
    control.setInactive = function () {
      control.domElement.classList.add('control-inactive')
    }

    control.setActive = function () {
      control.domElement.classList.remove('control-inactive')
    }

    const settings = baseActions[control.property]

    if (!settings || !settings.weight) {
      control.setInactive()
    }
  })
}

function activateAction(action) {
  const clip = action.getClip()
  const settings = baseActions[clip.name] || additiveActions[clip.name]
  setWeight(action, settings.weight)
  action.play()
}

function modifyTimeScale(speed) {
  mixer.timeScale = speed
}

function prepareCrossFade(startAction, endAction, duration) {
  try {
    // If the current action is 'idle', execute the crossfade immediately;
    // else wait until the current action has finished its current loop

    if (currentBaseAction === 'idle' || !startAction || !endAction) {
      executeCrossFade(startAction, endAction, duration)
    } else {
      synchronizeCrossFade(startAction, endAction, duration)
    }

    // Update control colors

    if (endAction) {
      const clip = endAction.getClip()
      currentBaseAction = clip.name
    } else {
      currentBaseAction = 'None'
    }

    crossFadeControls.forEach(function (control) {
      const name = control.property

      if (name === currentBaseAction) {
        control.setActive()
      } else {
        control.setInactive()
      }
    })
  } catch (err) {
    console.log('-->', err)
  }
}

function synchronizeCrossFade(startAction, endAction, duration) {
  mixer.addEventListener('loop', onLoopFinished)

  function onLoopFinished(event) {
    if (event.action === startAction) {
      mixer.removeEventListener('loop', onLoopFinished)

      executeCrossFade(startAction, endAction, duration)
    }
  }
}

function executeCrossFade(startAction, endAction, duration) {
  console.log('cf/', {startAction, endAction})

  try {
    // Not only the start action, but also the end action must get a weight of 1 before fading
    // (concerning the start action this is already guaranteed in this place)

    if (endAction) {
      setWeight(endAction, 1)
      endAction.time = 0

      if (startAction) {
        // Crossfade with warping

        startAction.crossFadeTo(endAction, duration, true)
      } else {
        // Fade in

        endAction.fadeIn(duration)
      }
    } else {
      // Fade out

      console.log(startAction)
      startAction?.fadeOut(duration)
    }
  } catch (err) {
    console.log('~---', err)
  }
}

// This function is needed, since animationAction.crossFadeTo() disables its start action and sets
// the start action's timeScale to ((start animation's duration) / (end animation's duration))

function setWeight(action, weight) {
  action.enabled = true
  action.setEffectiveTimeScale(1)
  action.setEffectiveWeight(weight)
}

function rotateCamera() {
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.autoRotate = true
  controls.autoRotateSpeed = 2.0
  controls.update()
}

function getLeftHandClip(model) {
  const bone = model.getObjectByName('mixamorigLeftHand')

  return new THREE.AnimationClip('cs_leftHand', -1, [
    new THREE.QuaternionKeyframeTrack(
      bone.name + '.quaternion',
      // Keyframe time value
      [0, 1, 2],
      // Quarternion identity rotation
      [0, 0, 0, 1, 0, 0, 0, 1]
    ),

    new THREE.QuaternionKeyframeTrack(
      bone.name + '.quaternion',
      // Keyframe time value
      [2, 4, 5],
      // Quarternion identity rotation
      [0, 0, 0, 1, 0, 0, 0, 1]
    ),
  ])
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  // Render loop

  requestAnimationFrame(animate)

  for (let i = 0; i !== numAnimations; ++i) {
    const action = allActions[i]
    const clip = action.getClip()
    const settings = baseActions[clip.name] || additiveActions[clip.name]
    settings.weight = 0
  }

  // Get the time elapsed since the last frame, used for mixer update

  const mixerUpdateDelta = clock.getDelta()

  // Update the animation mixer, the stats panel, and render this frame

  mixer.update(mixerUpdateDelta)

  stats.update()

  renderer.render(scene, camera)
}
