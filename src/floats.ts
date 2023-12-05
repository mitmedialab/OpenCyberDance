export function f32Append(source: Float32Array, items: number[]) {
  const dest = new Float32Array(source.length + items.length)
  dest.set(source)
  dest.set(items, source.length)

  return dest
}
