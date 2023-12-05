// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any) => any

export function debounce(fn: Fn, wait: number): Fn {
  let timer: number | undefined

  return function (...args) {
    clearTimeout(timer)

    // @ts-expect-error - `this` is not known
    timer = setTimeout(() => fn.apply(this, args), wait)
  }
}
