import * as THREE from 'three'
import Stats from 'three/addons/libs/stats.module.js'
import {GUI} from 'three/addons/libs/lil-gui.module.min.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

/** @type {THREE.Scene} */
let scene

/** @type {THREE.Renderer} */
let renderer

/** @type {THREE.Camera} */
let camera

let stats

/** @type {THREE.Scene} */
let model

/** @type {THREE.Skeleton} */
let skeleton

/** @type {THREE.AnimationMixer} */
let mixer

/** @type {THREE.Clock} */
let clock

// Allows each animation track to loop.
// Super memory and compute intensive, even though it's Float32Array.
// Slows down significantly after 1.
const EXTRA_TRACK_ITERATION = 0

const crossFadeControls = []

const anims = {
  a: 'no.33_.idel',
  b: 'no.57_.',
}

let currentBaseAction = 'idle'

const allActions = []

/** @type {Record<string, {weight: number, action: THREE.AnimationAction}>} */
const baseActions = {
  [anims.a]: {weight: 0},
  [anims.b]: {weight: 0},
}

const additiveActions = {}

let panelSettings, numAnimations

/** @type {Record<string, {eulers: THREE.Euler[], timings: number[], duration: number}[]>} */
const originalAnimations = {}

init()

/**
 * @param {THREE.KeyframeTrack[]} tracks
 */
function updateRotation(tracks) {
  tracks.forEach((track, trackIdx) => {
    const valueSize = track.getValueSize()

    // Only compute rotation for quaternion tracks.
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

    track.times.forEach((time, timeIdx) => {
      const valueOffset = timeIdx * valueSize

      const quaternion = new THREE.Quaternion().fromArray(
        track.values,
        valueOffset
      )

      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')

      const originalEuler =
        originalAnimations[currentBaseAction][trackIdx].eulers[timeIdx]

      euler.x = originalEuler.x
      euler.y = originalEuler.y
      euler.z = originalEuler.z

      // Amplify Euler angles
      euler.x *= rotationSettings.X
      euler.y *= rotationSettings.Y
      euler.z *= rotationSettings.Z

      // Convert back to quaternion
      quaternion.setFromEuler(euler)

      // Update track values
      quaternion.toArray(track.values, valueOffset)
    })
  })
}

/**
 * Lengthen the keyframe tracks, so that it loops properly.
 * We are only using one animation clip, so we need to lengthen the tracks.
 *
 * @param {THREE.KeyframeTrack[]} tracks
 */
function lengthenKeyframeTracks(tracks) {
  tracks.forEach((track) => {
    const finalTime = track.times[track.times.length - 1]

    track.times = f32Append(
      track.times,
      [...track.times].map((t) => t + finalTime)
    )

    track.values = f32Append(track.values, track.values)

    track.validate()
  })
}

/**
 * @param {Float32Array} source
 * @param {number[]} items
 * @returns
 */
function f32Append(source, items) {
  const dest = new Float32Array(source.length + items.length)
  dest.set(source)
  dest.set(items, source.length)

  return dest
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

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshPhongMaterial({color: 0xcbcbcb, depthWrite: false})
  )

  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  scene.add(mesh)

  const loader = new GLTFLoader()

  loader.load('model-v2.glb', (gltf) => {
    model = gltf.scene
    scene.add(model)

    console.log(gltf.animations)

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

    animations.forEach((animation) => {
      /** @type {THREE.KeyframeTrack[]} */
      const tracks = animation.tracks

      console.log('lkt/before', tracks[0].times.length)

      for (let i = 0; i < EXTRA_TRACK_ITERATION; i++) {
        lengthenKeyframeTracks(tracks)
      }
      console.log('lkt/after', tracks[0].times.length)

      tracks.forEach((track) => {
        const eulers = []

        // Original track timings before modification
        const timings = track.times.slice(0)
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

        track.validate()

        if (!originalAnimations[animation.name])
          originalAnimations[animation.name] = []

        const duration = track.times[track.times.length - 1] - track.times[0]

        originalAnimations[animation.name].push({eulers, timings, duration})
      })

      // debugger
    })

    window.originalAnimations = originalAnimations

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

    render()
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

/**
 * @param {THREE.KeyframeTrack} track
 */
const isTargetTrack = (track) => /Leg|Foot|Toe/.test(track.name)

const parts = {
  head: /Neck|Head/,
  legs: /Hips|Hips|RightUpLeg|RightLeg|RightFoot|LeftUpLeg|LeftLeg|LeftFoot/,
  body: /Spine|RightShoulder|RightArm|RightForeArm|RightHand|LeftShoulder|LeftArm|LeftForeArm|LeftHand/,
}

/** @type {Record<keyof typeof parts, number>} */
const energy = {
  // หัว
  head: 1,

  // แขนถึงลำตัว
  body: 1,

  // เอวลงขา
  legs: 1,
}

/**
 * @param {keyof typeof parts} part
 * @param {string} name
 * @returns {boolean}
 */
const isPart = (part, name) => parts[part].test(name)

/**
 * @param {string} name
 * @returns {string}
 */
function trackNameToPart(name) {
  for (const part of Object.keys(parts)) {
    if (isPart(part, name)) return part
  }
}

function alterRotation() {
  if (currentBaseAction === 'idle') return

  const clip = baseActions[currentBaseAction].action.getClip()
  updateRotation(clip.tracks)
}

/**
 *
 * @param {({track: THREE.KeyframeTrack, index: number, part: keyof typeof parts}) => void} onTrack
 * @returns
 */
function alterAnimationTrack(onTrack) {
  if (currentBaseAction === 'idle') return

  /** @type {THREE.AnimationAction} */
  const action = baseActions[currentBaseAction].action
  const clip = action.getClip()

  /** @type {THREE.KeyframeTrack[]} */
  const tracks = clip.tracks

  // window.trackNames = tracks.map((t) => t.name)

  tracks.forEach((track, trackIdx) => {
    try {
      const part = trackNameToPart(track.name)
      const original = originalAnimations[currentBaseAction][trackIdx]

      onTrack({track, part, original, index: trackIdx})
      tracks[trackIdx] = track

      if (!track.validate())
        console.warn('post-validation error:', track.name, track)
    } catch (err) {
      console.log(`[!] track error:`, err)
    }
  })

  /** @type {THREE.AnimationClip} */
  clip.tracks = tracks

  // TODO: does it work better if we uncache? this breaks crossfade tho!
  // mixer.uncacheClip(clip)

  const nextAction = mixer.clipAction(clip.clone())

  baseActions[currentBaseAction].action = nextAction

  const actionIdx = allActions.find(
    (a) => a.getClip().name === currentBaseAction
  )

  // TODO: cross-fade

  // nextAction.syncWith(action)
  nextAction.setEffectiveTimeScale(0)
  nextAction.time = action.time
  action.crossFadeTo(nextAction, 0.35, true)
  nextAction.play()
  nextAction.setEffectiveTimeScale(1)

  // mixer.addEventListener('loop', () => console.log('Loop!'))
  // mixer.addEventListener('finished', () => console.log('Finished!'))

  allActions[actionIdx] = nextAction

  window.tracks = tracks
  window.filteredTracks = tracks.filter(isTargetTrack)
}

function alterEnergy() {
  alterAnimationTrack(({track, original, part}) => {
    const factor = energy[part] ?? 1

    // Revert timing to original.
    track.times = original.timings.slice(0)

    // Scale up or down keyframe tracks.
    track.times = track.times.map((t) => {
      const value = t / factor
      if (isNaN(value)) return t

      return value
    })
  })
}

function createPanel() {
  const panel = new GUI({width: 310})

  const folder1 = panel.addFolder('Base Actions')
  const folder2 = panel.addFolder('Additive Action Weights')
  const folder3 = panel.addFolder('General Speed')
  const folder4 = panel.addFolder('All Rotations')
  const folder5 = panel.addFolder('Energy')

  folder4.add(rotationSettings, 'X', 1, 10).listen().onChange(alterRotation)
  folder4.add(rotationSettings, 'Y', 1, 10).listen().onChange(alterRotation)
  folder4.add(rotationSettings, 'Z', 1, 10).listen().onChange(alterRotation)

  folder5.add(energy, 'head', 0, 10, 0.01).listen().onChange(alterEnergy)
  folder5.add(energy, 'body', 0, 10, 0.01).listen().onChange(alterEnergy)
  folder5.add(energy, 'legs', 0, 10, 0.01).listen().onChange(alterEnergy)

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
      .onChange((weight) => {
        setWeight(settings.action, weight)
        settings.weight = weight
      })
  }

  folder3
    .add(panelSettings, 'modify time scale', 0.0, 5, 0.01)
    .onChange(modifyTimeScale)

  folder1.open()
  folder2.open()
  folder3.open()
  folder4.open()

  crossFadeControls.forEach((control) => {
    control.setInactive = () => {
      control.domElement.classList.add('control-inactive')
    }

    control.setActive = () => {
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
  console.log('preparing cross-fade', {startAction, endAction, duration})

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

    console.log('current base action ->', currentBaseAction)

    crossFadeControls.forEach((control) => {
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
    console.log('>>>> loop finished triggered')

    if (event.action === startAction) {
      mixer.removeEventListener('loop', onLoopFinished)

      executeCrossFade(startAction, endAction, duration)
    }
  }
}

function executeCrossFade(startAction, endAction, duration) {
  console.log('crossfading:', {startAction, endAction})

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
    console.log('crossfade error:', err)
  }
}

// This function is needed, since animationAction.crossFadeTo() disables its start action and sets
// the start action's timeScale to ((start animation's duration) / (end animation's duration))

function setWeight(action, weight) {
  action.enabled = true
  action.setEffectiveTimeScale(1)
  action.setEffectiveWeight(weight)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}

function render() {
  requestAnimationFrame(render)

  // for (let i = 0; i !== numAnimations; ++i) {
  //   const action = allActions[i]
  //   const clip = action.getClip()
  //   const settings = baseActions[clip.name] || additiveActions[clip.name]
  //   settings.weight = 0
  // }

  const mixerUpdateDelta = clock.getDelta()

  mixer.update(mixerUpdateDelta)

  stats.update()
  renderer.render(scene, camera)
}
