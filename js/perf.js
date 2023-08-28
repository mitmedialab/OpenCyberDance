export async function profile(label, callback) {
  const start = performance.now()
  callback()

  console.log(`> ${label} took ${performance.now() - start}ms`)
}
