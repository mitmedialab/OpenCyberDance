// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any) => any

export const profile =
  (label: string, threshold: number) =>
  <T extends Fn>(callback: T) => {
    performance.mark(`${label}-s`)

    const value = callback()
    performance.mark(`${label}-e`)

    const m = performance.measure(label, `${label}-s`, `${label}-e`)

    if (m.duration > threshold) {
      console.log(`> ${label} took ${m.duration}ms`)
    }

    return value
  }
