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
  private currentTargets: BoneRotationOffset[] = []
  private currentRotations: BoneRotationOffset[] = []
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

    this.isActive = true
    this.findArmBones()
    this.initializeRotations()
    this.generatePostureTargets()
    this.nextChangeTime = Date.now() + (3000 + Math.random() * 2000) // 3-5 seconds

    console.log(
      `Started posture sequence with ${this.armBones.length} arm bones`,
    )
  }

  stop() {
    this.isActive = false
    this.clearRotationOffsets()
    this.armBones = []
    this.currentTargets = []
    this.currentRotations = []

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

    console.log(
      'Found arm bones:',
      this.armBones.map((b) => b.name),
    )
  }

  private initializeRotations() {
    this.currentTargets = []
    this.currentRotations = []
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
    this.currentPostureIndex =
      (this.currentPostureIndex + 1) % PREDEFINED_POSTURES.length

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

      // 20% chance to add spinning before reaching target - like HTML prototype
      const shouldSpin = Math.random() < 0.2
      let targetRotation = { x: 0, y: 0, z: 0 }

      if (shouldSpin && !this.armSpinStates[index].isSpinning) {
        // Start spinning 1-2 times
        this.armSpinStates[index].isSpinning = true
        this.armSpinStates[index].targetSpins = Math.random() < 0.5 ? 1 : 2
        this.armSpinStates[index].spinCount = 0
        this.armSpinStates[index].spinAxis = ['x', 'y', 'z'][
          Math.floor(Math.random() * 3)
        ] as 'x' | 'y' | 'z'

        // Set dramatic spin rotation
        if (this.armSpinStates[index].spinAxis === 'x') {
          targetRotation.x = Math.PI * 2 * this.armSpinStates[index].targetSpins
        } else if (this.armSpinStates[index].spinAxis === 'y') {
          targetRotation.y = Math.PI * 2 * this.armSpinStates[index].targetSpins
        } else {
          targetRotation.z = Math.PI * 2 * this.armSpinStates[index].targetSpins
        }

        console.log(
          `Bone ${bone.name} will spin ${this.armSpinStates[index].targetSpins} times around ${this.armSpinStates[index].spinAxis}-axis`,
        )
      } else {
        // Get rotation from predefined posture
        const armConfig = isLeftArm
          ? currentPosture.leftArm
          : currentPosture.rightArm

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

  private clearRotationOffsets() {
    this.armBones.forEach((bone) => {
      delete bone.rotationOffset
      delete bone.randomRotationOffset
    })
  }

  // Main update function called from Character.tickRender() - matching HTML prototype
  updateRotations(delta: number) {
    if (!this.isActive || this.armBones.length === 0) return

    // Check if it's time to generate new posture targets
    if (Date.now() > this.nextChangeTime) {
      this.generatePostureTargets()
      this.nextChangeTime = Date.now() + (3000 + Math.random() * 2000) // 3-5 seconds
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

  // Method to manually trigger new posture
  triggerNewPosture() {
    if (this.isActive) {
      this.generatePostureTargets()
      this.nextChangeTime = Date.now() + 2000 // Reset timer
      console.log('Generated new random targets for smooth transition')
    }
  }
}
