export interface CameraPreset {
  zoom: number
  position: [number, number, number]
  rotation: [number, number, number, 'XYZ']
}

export const CAMERA_PRESETS = {
  front: {
    zoom: 0.45,
    position: [-0.1799835844727462, 1.0133617545109455, 2.8262908802109057],
    rotation: [
      -0.34836130411670063,
      -0.5679062624508247,
      -0.19290979124408733,
      'XYZ',
    ],
  },

  zoomFirst: {
    zoom: 0.45,
    position: [0.017562729875999012, 0.4385453544466625, 2.184576428532982],
    rotation: [
      0.07954774638211351,
      -0.0007542777216278531,
      0.00006012796747340352,
      'XYZ',
    ],
  },

  // endingStart: {
  //   zoom: 0.17834505001617867,
  //   position: [2.3012618796949735, 2.5935770573116206, 4.770715890320985],
  //   rotation: [
  //     -0.1317108930786508,
  //     0.02569207974791917,
  //     0.003403243788167311,
  //     'XYZ',
  //   ],
  // },

  endingStart: {
    zoom: 0.17834505001617867,
    position: [2.6365960830631106, 4.1762762317606335, 4.1522176539125875],
    rotation: [
      -0.3531269301145017,
      0.09804618766656269,
      0.03606397104147156,
      'XYZ',
    ],
  },

  ending: {
    zoom: 0.12454500000000221,
    position: [2.4048185003895903, 1.3751295937488033, 5.326242100368491],
    rotation: [
      -0.0557509607553926,
      -0.11682106516538056,
      -0.006504732007552551,
      'XYZ',
    ],
  },
} satisfies Record<string, CameraPreset>

export type CameraPresetKey = keyof typeof CAMERA_PRESETS
