import { Bone, Vector3 } from 'three'

import type { Character } from './character'
import { type Posture, PREDEFINED_POSTURES } from './postures'

// Simple bone rotation offset structure - matching HTML prototype
export interface BoneRotationOffset {
  x: number
  y: number
  z: number
}

// Spinning state structure from HTML prototype
export interface SpinState {
  isSpinning: boolean
  spinCount: number
  targetSpins: number
  spinAxis: 'x' | 'y' | 'z'
  originalTarget: BoneRotationOffset | null
}

// Extend Three.js Bone type to include all properties from HTML prototype
declare module 'three' {
  interface Bone {
    rotationOffset?: BoneRotationOffset
    randomRotationOffset?: BoneRotationOffset
    transitionSpeed?: number
    boneType?: 'upperarm' | 'forearm' | 'hand'
    isCollided?: boolean
  }
}

export class BoneRotationManager {
  private character: Character
  private armBones: Bone[] = []
  private headBones: Bone[] = []
  private currentTargets: BoneRotationOffset[] = []
  private currentRotations: BoneRotationOffset[] = []
  private headTargets: BoneRotationOffset[] = []
  private headRotations: BoneRotationOffset[] = []
  private currentPostureIndex = 0
  private nextChangeTime = 0
  private isActive = false
  private armSpinStates: SpinState[] = []
  private transitionSpeed = 6.0 // Default transition speed from HTML prototype

  constructor(character: Character) {
    this.character = character
  }

  start() {
    if (!this.character.model) return

    const delay = this.getPostureDelay()

    this.isActive = true
    this.findArmBones()
    this.findHeadBones()
    this.initializeRotations()
    this.generatePostureTargets()
    this.nextChangeTime = Date.now() + delay

    console.log(
      `Started posture sequence with ${this.armBones.length} arm bones. Posture delay: ${delay}ms`,
    )
  }

  stop() {
    this.isActive = false
    this.clearRotationOffsets()
    this.armBones = []
    this.headBones = []
    this.currentTargets = []
    this.currentRotations = []
    this.headTargets = []
    this.headRotations = []

    console.log('Stopped posture sequence')
  }

  // Find arm bones using dynamic traversal like HTML prototype
  private findArmBones() {
    if (!this.character.model) return

    this.armBones = []

    this.character.model.traverse((child) => {
      if ((child as Bone).isBone || child.type === 'Bone') {
        const name = child.name.toLowerCase()
        const bone = child as Bone

        // Include arm components for realistic pointing but exclude fingers
        // Matching the exact logic from HTML prototype
        if (
          (name.includes('arm') ||
            name.includes('forearm') ||
            name.includes('upperarm') ||
            name.includes('hand')) &&
          // Exclude shoulder/spine connections
          !name.includes('shoulder') &&
          !name.includes('clavicle') &&
          !name.includes('spine') &&
          !name.includes('neck') &&
          !name.includes('torso') &&
          !name.includes('chest') &&
          // Exclude all finger bones
          !name.includes('finger') &&
          !name.includes('thumb') &&
          !name.includes('index') &&
          !name.includes('middle') &&
          !name.includes('ring') &&
          !name.includes('pinky') &&
          !name.includes('pinkie')
        ) {
          // Categorize bones for different rotation speeds
          let boneType: 'upperarm' | 'forearm' | 'hand' = 'upperarm'
          if (name.includes('arm') && !name.includes('forearm')) {
            boneType = 'upperarm'
          } else if (name.includes('forearm')) {
            boneType = 'forearm'
          } else if (name.includes('hand')) {
            boneType = 'hand'
          }

          bone.boneType = boneType

          // Set transition speed based on bone type - matching HTML prototype
          switch (boneType) {
            case 'upperarm':
              bone.transitionSpeed = 3.0
              break
            case 'forearm':
              bone.transitionSpeed = 4.0
              break
            case 'hand':
              bone.transitionSpeed = 5.0
              break
          }

          this.armBones.push(bone)
        }
      }
    })

    // console.log(
    //   'Found arm bones:',
    //   this.armBones.map((b) => b.name),
    // )
  }

  // Find head bones using dynamic traversal
  private findHeadBones() {
    if (!this.character.model) return

    this.headBones = []

    this.character.model.traverse((child) => {
      if ((child as Bone).isBone || child.type === 'Bone') {
        const name = child.name.toLowerCase()
        const bone = child as Bone

        // Include head and neck bones for head movement
        if (
          (name.includes('head') ||
            name.includes('neck') ||
            name.includes('skull')) &&
          // Exclude hair/face features that shouldn't move
          !name.includes('hair') &&
          !name.includes('eye') &&
          !name.includes('mouth') &&
          !name.includes('jaw') &&
          !name.includes('tooth') &&
          !name.includes('tongue')
        ) {
          bone.boneType = 'head' as any
          bone.transitionSpeed = 2.0 // Slower transition speed for smoother head movement
          this.headBones.push(bone)
        }
      }
    })

    // console.log(
    //   'Found head bones:',
    //   this.headBones.map((b) => b.name),
    // )
  }

  private initializeRotations() {
    this.currentTargets = []
    this.currentRotations = []
    this.headTargets = []
    this.headRotations = []
    this.armSpinStates = []

    this.armBones.forEach((bone, index) => {
      this.currentTargets.push({ x: 0, y: 0, z: 0 })

      // Initialize current rotations from existing bone positions - like HTML prototype
      this.currentRotations.push({
        x: bone.randomRotationOffset ? bone.randomRotationOffset.x : 0,
        y: bone.randomRotationOffset ? bone.randomRotationOffset.y : 0,
        z: bone.randomRotationOffset ? bone.randomRotationOffset.z : 0,
      })

      // Initialize spin states for each bone
      this.armSpinStates.push({
        isSpinning: false,
        spinCount: 0,
        targetSpins: 0,
        spinAxis: 'z',
        originalTarget: null,
      })

      // Clear any existing rotation offsets
      if (bone.rotationOffset) {
        delete bone.rotationOffset
      }
    })

    // Initialize head bone rotations
    this.headBones.forEach((bone, index) => {
      this.headTargets.push({ x: 0, y: 0, z: 0 })
      this.headRotations.push({
        x: bone.randomRotationOffset ? bone.randomRotationOffset.x : 0,
        y: bone.randomRotationOffset ? bone.randomRotationOffset.y : 0,
        z: bone.randomRotationOffset ? bone.randomRotationOffset.z : 0,
      })

      // Clear any existing rotation offsets
      if (bone.rotationOffset) {
        delete bone.rotationOffset
      }
    })
  }

  private generatePostureTargets() {
    // Reset collision states for all bones so they can move again - like HTML prototype
    this.armBones.forEach((bone) => {
      bone.isCollided = false
    })

    const currentPosture = PREDEFINED_POSTURES[this.currentPostureIndex]
    console.log(
      `Switching to posture: ${currentPosture.name} - ${currentPosture.description}`,
    )

    // Move to next posture for next time
    const randomPostureIndex = Math.floor(
      Math.random() * PREDEFINED_POSTURES.length,
    )

    this.currentPostureIndex = randomPostureIndex

    this.armBones.forEach((bone, index) => {
      const name = bone.name.toLowerCase()
      const boneType = bone.boneType || 'upperarm'
      const isLeftArm = name.includes('left')

      // Initialize spin state if not exists
      if (!this.armSpinStates[index]) {
        this.armSpinStates[index] = {
          isSpinning: false,
          spinCount: 0,
          targetSpins: 0,
          spinAxis: 'z',
          originalTarget: null,
        }
      }

      let targetRotation = { x: 0, y: 0, z: 0 }

      // Get rotation from predefined posture
      const armConfig = isLeftArm
        ? currentPosture.leftArm
        : currentPosture.rightArm

      // If no arm configuration is defined, skip this bone (leave in natural position)
      if (!armConfig) {
        return // Skip this bone update - arm will stay in natural position
      }

      // Apply the predefined rotation based on bone type
      if (boneType === 'upperarm' && armConfig.upperarm) {
        targetRotation = { ...armConfig.upperarm }

        // Apply collision constraints
        const constrainedRotation = this.applyEnhancedUpperArmConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )

        // If collision detected, skip this bone completely
        if (constrainedRotation === null) {
          return // Skip this bone update
        }
        targetRotation = constrainedRotation
      } else if (boneType === 'forearm' && armConfig.forearm) {
        targetRotation = { ...armConfig.forearm }

        // Apply collision constraints
        const constrainedRotation = this.applyEnhancedForearmConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )

        // If collision detected, skip this bone completely
        if (constrainedRotation === null) {
          return // Skip this bone update
        }
        targetRotation = constrainedRotation
      } else if (boneType === 'hand' && armConfig.hand) {
        targetRotation = { ...armConfig.hand }

        // Apply collision constraints
        const constrainedRotation = this.applyEnhancedHandConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )

        // If collision detected, skip this bone completely
        if (constrainedRotation === null) {
          return // Skip this bone update
        }
        targetRotation = constrainedRotation
      } else {
        // For bones not specifically defined in posture, use neutral position
        targetRotation = { x: 0, y: 0, z: 0 }

        // Apply general constraints
        const constrainedRotation = this.applyEnhancedGeneralConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )

        // If collision detected, skip this bone completely
        if (constrainedRotation === null) {
          return // Skip this bone update
        }
        targetRotation = constrainedRotation
      }

      // Store the target rotation
      this.currentTargets[index] = targetRotation

      // Store transition speed based on bone type (different speeds for different parts)
      if (!this.armBones[index].transitionSpeed) {
        switch (boneType) {
          case 'upperarm':
            this.armBones[index].transitionSpeed = 3.0 // Slightly slower for more controlled movement
            break
          case 'forearm':
            this.armBones[index].transitionSpeed = 4.0 // Controlled speed
            break
          case 'hand':
            this.armBones[index].transitionSpeed = 5.0 // Faster for hand gestures
            break
          default:
            this.armBones[index].transitionSpeed = 3.5
        }
      }
    })

    // Apply head posture if defined
    if (currentPosture.head) {
      this.headBones.forEach((bone, index) => {
        if (!this.headTargets[index]) return

        // Apply the predefined head rotation with constraints
        const targetRotation = { ...currentPosture.head! }
        const constrainedRotation = this.applyHeadConstraints(targetRotation)

        this.headTargets[index] = constrainedRotation

        // console.log(
        //   `Set head bone ${bone.name} to x:${constrainedRotation.x.toFixed(
        //     2,
        //   )} y:${constrainedRotation.y.toFixed(
        //     2,
        //   )} z:${constrainedRotation.z.toFixed(2)}`,
        // )
      })
    } else {
      // Reset head to neutral position if no head posture is defined
      this.headBones.forEach((bone, index) => {
        if (!this.headTargets[index]) return
        this.headTargets[index] = { x: 0, y: 0, z: 0 }
      })
    }

    console.log(`Applied predefined posture: ${currentPosture.name}`)
  }

  // Collision detection for body parts - ported from HTML prototype
  private checkArmBodyCollision(
    bone: Bone,
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
  ): boolean {
    if (!bone.parent || !this.character.model) return false

    // Get bone world position to check collision
    bone.updateMatrixWorld()
    const boneWorldPos = new Vector3()
    bone.getWorldPosition(boneWorldPos)

    // Define body collision zones (torso, chest, belly area)
    const bodyZones = [
      { center: { x: 0, y: 1.2, z: 0 }, radius: 0.35 }, // Chest
      { center: { x: 0, y: 0.8, z: 0 }, radius: 0.4 }, // Belly
      { center: { x: 0, y: 1.0, z: 0 }, radius: 0.3 }, // Mid torso
      { center: { x: 0, y: 0.6, z: 0 }, radius: 0.35 }, // Lower torso
    ]

    // Calculate future bone position with proposed rotation
    const testRotation = {
      x: bone.rotation.x + rotation.x,
      y: bone.rotation.y + rotation.y,
      z: bone.rotation.z + rotation.z,
    }

    // Simulate bone position with new rotation
    const armLength = 0.6 // Approximate arm segment length
    const shoulderOffset = isLeftArm ? -0.4 : 0.4

    // Calculate where the bone would be with the new rotation
    const futurePos = {
      x: shoulderOffset + Math.sin(testRotation.z) * armLength,
      y: 1.5 + Math.sin(testRotation.y) * armLength,
      z: Math.sin(testRotation.x) * armLength,
    }

    // Check collision with each body zone
    for (const zone of bodyZones) {
      const distance = Math.sqrt(
        Math.pow(futurePos.x - zone.center.x, 2) +
          Math.pow(futurePos.y - zone.center.y, 2) +
          Math.pow(futurePos.z - zone.center.z, 2),
      )

      if (distance < zone.radius) {
        console.log(
          `Collision detected for ${bone.name} at zone ${zone.center.y}`,
        )
        return true // Collision detected
      }
    }

    return false // No collision
  }

  // Enhanced constraint functions with collision detection - ported from HTML prototype
  private applyEnhancedUpperArmConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
    bone?: Bone,
  ): BoneRotationOffset | null {
    // Enhanced ranges for more dramatic movements
    const maxInwardRotation = Math.PI / 8 // 22.5 degrees max inward (still conservative)
    const maxOutwardRotation = Math.PI / 1.2 // 150 degrees max outward (more dramatic)
    const maxForwardRotation = Math.PI / 2 // 90 degrees max forward (enhanced)
    const maxBackwardRotation = Math.PI / 2.5 // 72 degrees max backward (enhanced)

    // If bone is provided, check for collision first
    if (bone && this.checkArmBodyCollision(bone, rotation, isLeftArm)) {
      // Stop movement by marking bone as collided and keeping current position
      console.log(`${bone.name} stopped due to collision`)
      bone.isCollided = true
      return null // Signal to stop updating this bone
    }

    // Constrain X rotation (forward/backward) with enhanced range
    rotation.x = Math.max(
      -maxBackwardRotation,
      Math.min(maxForwardRotation, rotation.x),
    )

    // Constrain Y rotation (up/down) with enhanced range
    rotation.y = Math.max(-Math.PI / 1.5, Math.min(Math.PI / 1.5, rotation.y)) // Enhanced to ±120 degrees

    // Constrain Z rotation (inward/outward twist) - critical for body collision
    if (isLeftArm) {
      // Left arm: positive Z moves inward, negative Z moves outward
      rotation.z = Math.max(
        -maxOutwardRotation,
        Math.min(maxInwardRotation, rotation.z),
      )
    } else {
      // Right arm: negative Z moves inward, positive Z moves outward
      rotation.z = Math.max(
        -maxInwardRotation,
        Math.min(maxOutwardRotation, rotation.z),
      )
    }

    return rotation
  }

  // Original constraint functions maintained for compatibility
  private applyUpperArmConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
  ): BoneRotationOffset {
    const result = this.applyEnhancedUpperArmConstraints(rotation, isLeftArm)
    return result || rotation
  }

  private applyEnhancedForearmConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
    bone?: Bone,
  ): BoneRotationOffset | null {
    // Enhanced forearm movements with wider range but still safe
    const maxBendAngle = Math.PI / 1.5 // Enhanced to 120 degrees max bend

    // If bone is provided, check for collision first
    if (bone && this.checkArmBodyCollision(bone, rotation, isLeftArm)) {
      console.log(`${bone.name} forearm stopped due to collision`)
      bone.isCollided = true
      return null // Signal to stop updating this bone
    }

    // Enhanced bending range
    rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotation.x)) // Enhanced to ±60 degrees
    rotation.y = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rotation.y)) // Enhanced to ±45 degrees

    // Enhanced Z rotation with more dramatic range but still safe
    if (isLeftArm) {
      rotation.z = Math.max(-Math.PI / 4, Math.min(maxBendAngle, rotation.z)) // Allow some inward but prefer outward
    } else {
      rotation.z = Math.max(-maxBendAngle, Math.min(Math.PI / 4, rotation.z)) // Allow some inward but prefer outward
    }

    return rotation
  }

  private applyForearmConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
  ): BoneRotationOffset {
    const result = this.applyEnhancedForearmConstraints(rotation, isLeftArm)
    return result || rotation
  }

  private applyEnhancedHandConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
    bone?: Bone,
  ): BoneRotationOffset | null {
    // Enhanced hands with more dramatic freedom
    const maxRotation = Math.PI / 2 // Enhanced to 90 degrees max in any direction

    // If bone is provided, check for collision first
    if (bone && this.checkArmBodyCollision(bone, rotation, isLeftArm)) {
      console.log(`${bone.name} hand stopped due to collision`)
      bone.isCollided = true
      return null // Signal to stop updating this bone
    }

    rotation.x = Math.max(-maxRotation, Math.min(maxRotation, rotation.x))
    rotation.y = Math.max(-maxRotation, Math.min(maxRotation, rotation.y))
    rotation.z = Math.max(-maxRotation, Math.min(maxRotation, rotation.z))

    return rotation
  }

  private applyHandConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
  ): BoneRotationOffset {
    const result = this.applyEnhancedHandConstraints(rotation, isLeftArm)
    return result || rotation
  }

  private applyEnhancedGeneralConstraints(
    rotation: BoneRotationOffset,
    isLeftArm: boolean,
    bone?: Bone,
  ): BoneRotationOffset | null {
    // Enhanced general constraints for dramatic movements
    const maxRotation = Math.PI / 2.5 // Enhanced to 72 degrees max

    // If bone is provided, check for collision first
    if (bone && this.checkArmBodyCollision(bone, rotation, isLeftArm)) {
      console.log(`${bone.name} general bone stopped due to collision`)
      bone.isCollided = true
      return null // Signal to stop updating this bone
    }

    rotation.x = Math.max(-maxRotation, Math.min(maxRotation, rotation.x))
    rotation.y = Math.max(-maxRotation, Math.min(maxRotation, rotation.y))
    rotation.z = Math.max(-maxRotation, Math.min(maxRotation, rotation.z))

    return rotation
  }

  private applyGeneralConstraints(
    rotation: BoneRotationOffset,
  ): BoneRotationOffset {
    const result = this.applyEnhancedGeneralConstraints(rotation, false)
    return result || rotation
  }

  private applyHeadConstraints(
    rotation: BoneRotationOffset,
  ): BoneRotationOffset {
    // Conservative head movement ranges for safety
    const maxHeadRotation = Math.PI / 4 // 45 degrees max in any direction

    rotation.x = Math.max(
      -maxHeadRotation,
      Math.min(maxHeadRotation, rotation.x),
    )
    rotation.y = Math.max(
      -maxHeadRotation,
      Math.min(maxHeadRotation, rotation.y),
    )
    rotation.z = Math.max(
      -maxHeadRotation,
      Math.min(maxHeadRotation, rotation.z),
    )

    return rotation
  }

  private clearRotationOffsets() {
    this.armBones.forEach((bone) => {
      delete bone.rotationOffset
      delete bone.randomRotationOffset
    })
    this.headBones.forEach((bone) => {
      delete bone.rotationOffset
      delete bone.randomRotationOffset
    })
  }

  // Main update function called from Character.tickRender() - matching HTML prototype
  updateRotations(delta: number) {
    if (!this.isActive || this.armBones.length === 0) return

    // If debug mode is enabled, skip automatic posture generation
    if (this.character.params?.postureDebug.enabled) {
      // Debug mode is active - use debug targets instead of automatic postures
    } else {
      // Check if it's time to generate new posture targets
      if (Date.now() > this.nextChangeTime) {
        this.generatePostureTargets()
        this.nextChangeTime = Date.now() + this.getPostureDelay()
      }
    }

    // Smoothly interpolate current rotations toward targets with individual speeds
    this.armBones.forEach((bone, index) => {
      if (!this.currentRotations[index] || !this.currentTargets[index]) return

      // Skip bones that have collided and should stay in place
      if (bone.isCollided) return

      const current = this.currentRotations[index]
      const target = this.currentTargets[index]

      // Use individual bone transition speed
      const boneSpeed = bone.transitionSpeed || this.transitionSpeed
      const speed = Math.min(boneSpeed * delta, 1.0) // Cap the interpolation speed

      // Smooth lerp toward target with different speeds for each component
      current.x = current.x + (target.x - current.x) * speed
      current.y = current.y + (target.y - current.y) * speed
      current.z = current.z + (target.z - current.z) * speed

      // Store as offset to be applied after animation
      if (!bone.randomRotationOffset) {
        bone.randomRotationOffset = { x: 0, y: 0, z: 0 }
      }

      bone.randomRotationOffset.x = current.x
      bone.randomRotationOffset.y = current.y
      bone.randomRotationOffset.z = current.z
    })

    // Update head bones (both for posture system and debug mode)
    this.headBones.forEach((bone, index) => {
      if (!this.headRotations[index] || !this.headTargets[index]) return

      const current = this.headRotations[index]
      const target = this.headTargets[index]

      // Use slower transition speed for head movement
      const boneSpeed = bone.transitionSpeed || 2.0
      const speed = Math.min(boneSpeed * delta, 1.0)

      // Smooth lerp toward target
      current.x = current.x + (target.x - current.x) * speed
      current.y = current.y + (target.y - current.y) * speed
      current.z = current.z + (target.z - current.z) * speed

      // Store as offset to be applied after animation
      if (!bone.randomRotationOffset) {
        bone.randomRotationOffset = { x: 0, y: 0, z: 0 }
      }

      bone.randomRotationOffset.x = current.x
      bone.randomRotationOffset.y = current.y
      bone.randomRotationOffset.z = current.z
    })
  }

  get isPostureActive(): boolean {
    return this.isActive
  }

  get currentPostureName(): string {
    if (!this.isActive) return 'None'
    const prevIndex =
      (this.currentPostureIndex - 1 + PREDEFINED_POSTURES.length) %
      PREDEFINED_POSTURES.length
    return PREDEFINED_POSTURES[prevIndex].name
  }

  get availablePostures(): Posture[] {
    return PREDEFINED_POSTURES
  }

  getPostureDelay() {
    const axisPointFrequency = this.character.params?.axisPoint.frequency ?? 0
    const slowest = 7000
    const fastest = 600

    return Math.abs(slowest + (fastest - slowest) * axisPointFrequency)
  }

  // Method to update targets from debug panel
  triggerDebugUpdate() {
    if (!this.character.params?.postureDebug.enabled) return

    // console.log('Applying debug posture targets')

    this.armBones.forEach((bone, index) => {
      const name = bone.name.toLowerCase()
      const boneType = bone.boneType || 'upperarm'
      const isLeftArm = name.includes('left')

      // Get debug configuration for this arm
      const debugArm = isLeftArm
        ? this.character.params!.postureDebug.leftArm
        : this.character.params!.postureDebug.rightArm

      let targetRotation = { x: 0, y: 0, z: 0 }

      // Apply debug rotation based on bone type
      if (boneType === 'upperarm' && debugArm.upperarm) {
        targetRotation = { ...debugArm.upperarm }
      } else if (boneType === 'forearm' && debugArm.forearm) {
        targetRotation = { ...debugArm.forearm }
      } else if (boneType === 'hand' && debugArm.hand) {
        targetRotation = { ...debugArm.hand }
      }

      // Apply bone-specific constraints like the posture system does
      let constrainedRotation: BoneRotationOffset | null = null
      if (boneType === 'upperarm') {
        constrainedRotation = this.applyEnhancedUpperArmConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )
      } else if (boneType === 'forearm') {
        constrainedRotation = this.applyEnhancedForearmConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )
      } else if (boneType === 'hand') {
        constrainedRotation = this.applyEnhancedHandConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )
      } else {
        constrainedRotation = this.applyEnhancedGeneralConstraints(
          targetRotation,
          isLeftArm,
          bone,
        )
      }

      if (constrainedRotation) {
        this.currentTargets[index] = constrainedRotation
        // console.log(
        //   `Debug: Set ${bone.name} to x:${targetRotation.x.toFixed(
        //     2,
        //   )} y:${targetRotation.y.toFixed(2)} z:${targetRotation.z.toFixed(2)}`,
        // )
      }
    })

    // Update head bones with debug targets
    this.headBones.forEach((bone, index) => {
      if (!this.headTargets[index]) return

      // Get debug head configuration
      const debugHead = this.character.params!.postureDebug.head

      // Apply debug rotation with constraints
      const targetRotation = { ...debugHead }
      const constrainedRotation = this.applyHeadConstraints(targetRotation)

      this.headTargets[index] = constrainedRotation
    })
  }
}
