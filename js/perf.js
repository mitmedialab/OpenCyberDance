export async function profile(label, callback) {
  const start = performance.now()
  await callback()

  console.log(`> ${label} took ${performance.now() - start}ms`)
}
