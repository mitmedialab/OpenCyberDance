export interface CameraPreset {
  position: [number, number, number]
  rotation: [number, number, number, 'XYZ']
}

export const CAMERA_PRESETS = {
  front: {
    rotation: [
      0.019524140036770925,
      -0.19748246960742158,
      0.00383113082788773,
      'XYZ',
    ],

    position: [-0.0022802705476955287, 0.7597713647168783, 3.013557549091543],
  },

  zoomFirst: {
    rotation: [
      0.07954774638211351,
      -0.0007542777216278531,
      0.00006012796747340352,
      'XYZ',
    ],

    position: [0.017562729875999012, 0.4385453544466625, 2.184576428532982],
  },
} satisfies Record<string, CameraPreset>

export type CameraPresetKey = keyof typeof CAMERA_PRESETS