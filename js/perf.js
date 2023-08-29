export async function profile(label, callback, threshold = 10) {
  const start = performance.now()
  callback()

  const time = performance.now() - start
  if (time > threshold) console.log(`> ${label} took ${time}ms`)
}
