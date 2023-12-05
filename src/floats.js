/**
 * @param {Float32Array} source
 * @param {number[]} items
 * @returns
 */
export function f32Append(source, items) {
  const dest = new Float32Array(source.length + items.length)
  dest.set(source)
  dest.set(items, source.length)

  return dest
}
