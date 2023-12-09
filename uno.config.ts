import presetWind from '@unocss/preset-wind'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
    presetTypography(),
    presetWebFonts({
      provider: 'none',
      fonts: {
        zed: ['Zed Mono Extended'],
      },
    }),
    presetWind(),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
})
