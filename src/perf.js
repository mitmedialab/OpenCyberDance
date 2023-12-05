export const profile = (label, threshold) => (callback) => {
  performance.mark(`${label}-s`)

  const value = callback()
  performance.mark(`${label}-e`)

  const m = performance.measure(label, `${label}-s`, `${label}-e`)

  if (m.duration > threshold) {
    console.log(`> ${label} took ${m.duration}ms`)
  }

  return value
}
