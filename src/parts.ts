type PartMap = Record<string, RegExp>

/// energy
export const energyParts = {
  lower:
    /Hips|RightUpLeg|RightLeg|RightFoot|LeftUpLeg|LeftLeg|LeftFoot|RightInHand/,
  upper:
    /Head|Neck|Spine|RightShoulder|RightArm|RightForeArm|RightHand|LeftShoulder|LeftArm|LeftForeArm|LeftHand/,
} satisfies PartMap

export const delayParts = {
  head: /Head|Neck/,
  body: /Hips|Spine/,
  leftArm: /LeftShoulder|LeftArm|LeftForeArm|LeftHand|LeftInHand/,
  rightArm: /RightShoulder|RightArm|RightForeArm|RightHand|RightInHand/,
  leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/,
  rightLeg: /RightUpLeg|RightLeg|RightFoot/,
} satisfies PartMap

export const curveParts = {
  head: /Head|Neck/,
  body: /Head|Neck|Hips|Spine/,
  leftArm: /LeftShoulder|LeftArm|LeftForeArm/,
  rightArm: /RightShoulder|RightArm|RightForeArm/,
  leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/,
  rightLeg: /RightUpLeg|RightLeg|RightFoot/,
} satisfies PartMap

export const axisPointControlParts = {
  leftArm: /LeftShoulder|LeftArm|LeftForeArm/,
  rightArm: /RightShoulder|RightArm|RightForeArm/,
  leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/,
  rightLeg: /RightUpLeg|RightLeg|RightFoot/,
} satisfies PartMap

export type EnergyPartKey = keyof typeof energyParts
export type DelayPartKey = keyof typeof delayParts
export type CurvePartKey = keyof typeof curveParts
export type AxisPointControlParts = keyof typeof axisPointControlParts

export const isEnergyPart = (part: EnergyPartKey, name: string): boolean =>
  energyParts[part].test(name)

export const isDelayPart = (part: DelayPartKey, name: string): boolean =>
  delayParts[part]?.test(name)

export const isAxisPointControlPart = (
  part: AxisPointControlParts,
  name: string,
): boolean => axisPointControlParts[part]?.test(name)

export function trackNameToPart(name: string, type: 'core' | 'delay' | 'axis') {
  if (type === 'core') {
    for (const part in energyParts) {
      if (isEnergyPart(part as EnergyPartKey, name)) return part
    }
  }

  if (type === 'delay') {
    for (const part in delayParts) {
      if (isDelayPart(part as DelayPartKey, name)) return part
    }
  }

  if (type === 'axis') {
    for (const part in axisPointControlParts) {
      if (isAxisPointControlPart(part as AxisPointControlParts, name))
        return part
    }
  }
}
