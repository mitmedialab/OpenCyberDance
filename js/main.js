import * as THREE from 'three'
import Stats from 'three/addons/libs/stats.module.js'
import {GUI} from 'three/addons/libs/lil-gui.module.min.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {KeyframeAnalyzer, toBone, toEuler} from './analyze.js'
import {dispose} from './dispose.js'

const ANALYZER_ENABLED = false

/** @type {THREE.Scene} */
let scene

/** @type {THREE.Renderer} */
let renderer

/** @type {THREE.Camera} */
let camera

let stats

/** @type {THREE.Scene} */
let model

/** @type {THREE.Scene} */
let model2

/** @type {THREE.Skeleton} */
let skeleton

/** @type {THREE.Skeleton2} */
let skeleton2

/** @type {THREE.AnimationMixer} */
let mixer

/** @type {THREE.AnimationMixer} */
let mixer2

/** @type {THREE.Clock} */
let clock

/** @type {THREE.Points} */
let points

// let analyzer = new KeyframeAnalyzer()

// Allows each animation track to loop.
// Super memory and compute intensive, even though it's Float32Array.
// Slows down significantly after 1.
const EXTRA_TRACK_ITERATION = 2

const crossFadeControls = []

let currentBaseAction = 'idle'

const allActions = []

/** @type {Record<string, {weight: number, action: THREE.AnimationAction}>} */
const baseActions = {}

/** @type {Record<string, THREE.AnimationAction>} */
const originalActions = {}

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

// function debugAddPointClouds(tracks) {
//   // Clear existing objects.
//   if (points) {
//     points.traverse((obj) => points.remove(obj))
//     scene.remove(points)
//   }

//   const times = analyzer.times

//   if (times.length === 0) {
//     console.warn('analyzer cannot find any keyframes!')
//     return
//   }

//   const geometry = new THREE.BufferGeometry()

//   const V_SIZE = 3
//   const positions = new Float32Array(times.length * V_SIZE)

//   times.forEach((time) => {
//     const keyframes = analyzer.getKeyframesAtTime(time)

//     keyframes.forEach((part, i) => {
//       const v = part.value.v
//       // const bone = model.getObjectByName(toBone(part.track))

//       if (v instanceof THREE.Vector3) {
//         positions[i] = v.x
//         positions[i + 1] = v.y
//         positions[i + 2] = v.z
//       }

//       // TODO: we can't do this because rotations cannot be plotted as positions.
//       // if (v instanceof THREE.Quaternion) {
//       //   const r = bone.rotation.clone().setFromQuaternion(v)
//       //   positions[i] = r.x
//       //   positions[i + 1] = r.y
//       //   positions[i + 2] = r.z
//       // }
//     })
//   })

//   console.log(`> adding ${times.length} point clouds`)

//   // const sprite = new THREE.TextureLoader().load('disc.png')
//   // sprite.colorSpace = THREE.SRGBColorSpace

//   const attribute = new THREE.BufferAttribute(positions, V_SIZE)
//   geometry.setAttribute('position', attribute)

//   const material = new THREE.PointsMaterial({
//     size: 0.1,
//     alphaTest: 0.2,
//     transparent: true,
//   })

//   material.color.setHSL(0.5, Math.random(), Math.random(), THREE.SRGBColorSpace)

//   points = new THREE.Points(geometry, material)
//   scene.add(points)
// }

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

  const modelFileName = '008test.glb'
  addPrimaryCharacter(modelFileName)
  addSecondCharacter(modelFileName)

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
  controls.enablePan = true
  controls.enableZoom = true
  controls.target.set(0, 1, 0)
  controls.update()

  stats = new Stats()
  container.appendChild(stats.dom)

  window.addEventListener('resize', onWindowResize)
}

function addPrimaryCharacter(file) {
  const loader = new GLTFLoader()

  dispose(model)

  loader.load(file, (gltf) => {
    model = gltf.scene
    scene.add(model)

    model.traverse((object) => {
      if (object.isMesh) object.castShadow = true
    })

    const s = 0.008
    model.scale.set(s, s, s)
    model.position.set(0, 0, -0.5)

    skeleton = new THREE.SkeletonHelper(model)
    skeleton.visible = false
    scene.add(skeleton)

    /** @type {THREE.AnimationClip[]} */
    const animations = gltf.animations
    numAnimations = animations.length

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
    })

    window.originalAnimations = originalAnimations

    mixer = new THREE.AnimationMixer(model)

    for (let i = 0; i !== numAnimations; ++i) {
      /** @type {THREE.AnimationClip} */
      let clip = animations[i]

      const name = clip.name
      console.log('clipName', name)

      const action = mixer.clipAction(clip)

      baseActions[name] = {}
      baseActions[name].weight = 0.0
      baseActions[name].action = action

      activateAction(action)
      allActions.push(action)

      // if (additiveActions[name]) {
      //   // Make the clip additive and remove the reference frame
      //   THREE.AnimationUtils.makeClipAdditive(clip)

      //   if (clip.name.endsWith('_pose')) {
      //     clip = THREE.AnimationUtils.subclip(clip, clip.name, 2, 3, 30)
      //   }

      //   const action = mixer.clipAction(clip)
      //   activateAction(action)
      //   additiveActions[name].action = action
      //   allActions.push(action)
      // }
    }

    createPanel()

    render()
  })
}

function addSecondCharacter(file) {
  const loader = new GLTFLoader()

  dispose(model2)

  loader.load(file, (gltf) => {
    model2 = gltf.scene
    scene.add(model2)

    model2.traverse((object) => {
      if (object.isMesh) object.castShadow = true
    })

    const s = 0.008
    model2.scale.set(s, s, s)
    model2.position.set(-1.5, 0, -0.5)
    model2.visible = false

    skeleton2 = new THREE.SkeletonHelper(model2)
    skeleton2.visible = false
    scene.add(skeleton2)

    mixer2 = new THREE.AnimationMixer(model2)

    gltf.animations.forEach((animation) => {
      /** @type {THREE.KeyframeTrack[]} */
      const tracks = animation.tracks
      const clip = new THREE.AnimationClip(animation.name, -1, tracks)
      const action = new THREE.AnimationAction(mixer2, clip)

      originalActions[animation.name] = action
    })
  })
}

/**
 * @param {THREE.KeyframeTrack} track
 */
const isTargetTrack = (track) => /Leg|Foot|Toe/.test(track.name)

const coreParts = {
  head: /Neck|Head/,
  legs: /Hips|RightUpLeg|RightLeg|RightFoot|LeftUpLeg|LeftLeg|LeftFoot|RightInHand/,
  body: /Spine|RightShoulder|RightArm|RightForeArm|RightHand|LeftShoulder|LeftArm|LeftForeArm|LeftHand/,
}

const delayParts = {
  head: /Head|Neck/,
  body: /Hips|Spine/,
  leftArm: /LeftShoulder|LeftArm|LeftForeArm|LeftHand|LeftInHand/,
  rightArm: /RightShoulder|RightArm|RightForeArm|RightHand|RightInHand/,
  leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/,
  rightLeg: /RightUpLeg|RightLeg|RightFoot/,
}

const rotationSettings = {X: 1.0, Y: 1.0, Z: 1.0}

/** @type {Record<keyof typeof coreParts, number>} */
const energy = {
  // หัว
  head: 1,

  // แขนถึงลำตัว
  body: 1,

  // เอวลงขา
  legs: 1,
}

/** @type {Record<keyof typeof delayParts, number>} */
const delays = {
  // head: 0,
  // body: 0,
  // legs: 0,
  leftArm: 0,
  rightArm: 0,
  leftLeg: 0,
  rightLeg: 0,
}

/**
 * @param {keyof typeof coreParts} part
 * @param {string} name
 * @returns {boolean}
 */
const isCorePart = (part, name) => coreParts[part].test(name)

/**
 * @param {keyof typeof delayParts} part
 * @param {string} name
 * @returns {boolean}
 */
const isDelayPart = (part, name) => delayParts[part]?.test(name)

/**
 * @param {string} name
 * @param {'core' | 'delay'} type
 */
function trackNameToPart(name, type) {
  if (type === 'core') {
    for (const part of Object.keys(coreParts)) {
      if (isCorePart(part, name)) return part
    }
  } else if (type === 'delay') {
    for (const part of Object.keys(delayParts)) {
      if (isDelayPart(part, name)) return part
    }
  }

  console.warn(`Unmatched part:`, {name, type})
}

function alterRotation() {
  if (currentBaseAction === 'idle') return

  const clip = baseActions[currentBaseAction].action.getClip()
  updateRotation(clip.tracks)
}

/**
 * @param {({track: THREE.KeyframeTrack, index: number, original: any}) => void} onTrack
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
      const original = originalAnimations[currentBaseAction][trackIdx]

      onTrack({track, original, index: trackIdx})
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

  allActions[actionIdx] = nextAction

  window.tracks = tracks
  window.filteredTracks = tracks.filter(isTargetTrack)
}

/**
 * @param {THREE.KeyframeTrack} track
 */
function alterDelay(track) {
  const part = trackNameToPart(track.name, 'delay')

  const offset = delays[part] ?? 0
  if (offset > 0) track.shift(offset)
}

/**
 * @param {THREE.KeyframeTrack} track
 */
function alterEnergy(track) {
  const part = trackNameToPart(track.name, 'core')
  const factor = energy[part] ?? 1

  // Scale up or down keyframe tracks.
  track.times = track.times.map((t) => {
    if (factor === 1) return t

    const value = t / factor
    if (isNaN(value)) return t

    return value
  })
}

function updateAnimationValues() {
  alterAnimationTrack(({track, original}) => {
    track.times = original.timings.slice(0)

    alterDelay(track, original)
    alterEnergy(track, original)
  })
}

const secondCharacter = {visible: false}

function createPanel() {
  const panel = new GUI({width: 310})

  const baseFolder = panel.addFolder('Base Actions')
  const additiveFolder = panel.addFolder('Additive Action Weights')
  const speedFolder = panel.addFolder('General Speed')
  const rotFolder = panel.addFolder('All Rotations')
  const energyFolder = panel.addFolder('Energy')
  const delayFolder = panel.addFolder('Delays')
  const secondCharFolder = panel.addFolder('Second Character')

  rotFolder.add(rotationSettings, 'X', 1, 10).listen().onChange(alterRotation)
  rotFolder.add(rotationSettings, 'Y', 1, 10).listen().onChange(alterRotation)
  rotFolder.add(rotationSettings, 'Z', 1, 10).listen().onChange(alterRotation)

  secondCharFolder
    .add(secondCharacter, 'visible', false)
    .listen()
    .onChange(() => {
      model2.visible = secondCharacter.visible
    })

  /**
   * @param {keyof typeof coreParts} parts
   */
  const addEnergy = (...parts) => {
    parts.forEach((part) => {
      energyFolder
        .add(energy, part, 1, 8, 0.01)
        .listen()
        .onChange(updateAnimationValues)
    })
  }

  /**
   * @param {keyof typeof delayParts} parts
   */
  const addDelay = (...parts) => {
    parts.forEach((part) => {
      delayFolder
        .add(delays, part, -10, 10, 0.01)
        .listen()
        .onChange(updateAnimationValues)
    })
  }

  addEnergy('head', 'body', 'legs')
  addDelay('leftArm', 'rightArm', 'leftLeg', 'rightLeg')

  // delayFolder.add(delays, 'body', -100, 100, 1).listen().onChange(alterDelay)
  // delayFolder.add(delays, 'legs', -100, 100, 1).listen().onChange(alterDelay)

  panelSettings = {
    'modify time scale': 1.0,
  }

  const baseNames = ['None', ...Object.keys(baseActions)]

  for (let i = 0, l = baseNames.length; i !== l; ++i) {
    const name = baseNames[i]
    const settings = baseActions[name]

    /**
     * This is activated when we switch!
     */
    panelSettings[name] = function () {
      const currentSettings = baseActions[currentBaseAction]
      const currentAction = currentSettings ? currentSettings.action : null
      const action = settings ? settings.action : null

      if (currentAction !== action) {
        prepareCrossFade(currentAction, action, 0.35)
      }

      // Secondary character
      if (!currentBaseAction || currentBaseAction === 'None') {
        mixer2.stopAllAction()
      } else {
        const a2 = originalActions[currentBaseAction]
        a2.play()
      }

      // if (ANALYZER_ENABLED) analyzer.analyze(tracks)
      // debugAddPointClouds(action.getClip().tracks)
    }

    crossFadeControls.push(baseFolder.add(panelSettings, name))
  }

  for (const name of Object.keys(additiveActions)) {
    const settings = additiveActions[name]

    panelSettings[name] = settings.weight
    additiveFolder
      .add(panelSettings, name, 0.0, 1.0, 0.01)
      .listen()
      .onChange((weight) => {
        setWeight(settings.action, weight)
        settings.weight = weight
      })
  }

  speedFolder
    .add(panelSettings, 'modify time scale', 0.0, 5, 0.01)
    .onChange(modifyTimeScale)

  baseFolder.open()
  additiveFolder.open()
  speedFolder.open()
  rotFolder.open()

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

/**
 * @param {THREE.AnimationAction} action
 */
function activateAction(action) {
  const clip = action.getClip()

  const settings = baseActions[clip.name] || additiveActions[clip.name]
  setWeight(action, settings.weight)
  // action.startAt(clip.duration / 2)
  action.play()
}

function modifyTimeScale(speed) {
  mixer.timeScale = speed
  mixer2.timeScale = speed
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

  for (let i = 0; i !== numAnimations; ++i) {
    const action = allActions[i]
    if (!action) continue

    const clip = action.getClip()
    const settings = baseActions[clip.name] || additiveActions[clip.name]
    settings.weight = 0
  }

  const mixerUpdateDelta = clock.getDelta()
  mixer.update(mixerUpdateDelta)
  if (mixer2) mixer2.update(mixerUpdateDelta)

  // const baseActionTime = baseActions[currentBaseAction]?.action?.time

  stats.update()
  renderer.render(scene, camera)
}
