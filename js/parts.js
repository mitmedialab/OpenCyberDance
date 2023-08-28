export const coreParts = {
  head: /Neck|Head/,
  legs: /Hips|RightUpLeg|RightLeg|RightFoot|LeftUpLeg|LeftLeg|LeftFoot|RightInHand/,
  body: /Spine|RightShoulder|RightArm|RightForeArm|RightHand|LeftShoulder|LeftArm|LeftForeArm|LeftHand/,
}

export const delayParts = {
  head: /Head|Neck/,
  body: /Hips|Spine/,
  leftArm: /LeftShoulder|LeftArm|LeftForeArm|LeftHand|LeftInHand/,
  rightArm: /RightShoulder|RightArm|RightForeArm|RightHand|RightInHand/,
  leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/,
  rightLeg: /RightUpLeg|RightLeg|RightFoot/,
}

/**
 * @param {keyof typeof coreParts} part
 * @param {string} name
 * @returns {boolean}
 */
export const isCorePart = (part, name) => coreParts[part].test(name)

/**
 * @param {keyof typeof delayParts} part
 * @param {string} name
 * @returns {boolean}
 */
export const isDelayPart = (part, name) => delayParts[part]?.test(name)

/**
 * @param {string} name
 * @param {'core' | 'delay'} type
 */
export function trackNameToPart(name, type) {
  if (type === 'core') {
    for (const part of Object.keys(coreParts)) {
      if (isCorePart(part, name)) return part
    }
  } else if (type === 'delay') {
    for (const part of Object.keys(delayParts)) {
      if (isDelayPart(part, name)) return part
    }
  }
}
