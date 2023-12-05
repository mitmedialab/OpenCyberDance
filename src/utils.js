/**
 * @param {Function} fn
 * @param {number} wait
 * @returns
 */
export function debounce(fn, wait) {
  let timer

  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), wait)
  }
}
