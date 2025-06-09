function getPostureDelay(frequency) {
  const axisPointFrequency = frequency
  console.log('axisPointFrequency', axisPointFrequency)

  if (axisPointFrequency === undefined || axisPointFrequency === 0) {
    return 2000
  }

  // Linear interpolation: 1% -> 10000ms, 100% -> 500ms
  const minDelay = 500 // 0.5 seconds at 100%
  const maxDelay = 10000 // 10 seconds at 1%

  return maxDelay - (axisPointFrequency) * (maxDelay - minDelay)
}

getPostureDelay(1) //?
