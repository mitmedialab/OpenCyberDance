export interface CameraPreset {
  position: [number, number, number]
  rotation: [number, number, number, 'XYZ']
}

export const CAMERA_PRESETS = {
  front: {
    rotation: [
      -0.34836130411670063,
      -0.5679062624508247,
      -0.19290979124408733,
      'XYZ',
    ],

    position: [-0.1799835844727462, 1.0133617545109455, 2.8262908802109057],
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
