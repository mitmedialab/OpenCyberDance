export function findMostFrequentNumber(xs: string[]): number {
  // Extract numbers using regex and convert to numbers
  const numbers = xs
    .map((s) => {
      const match = s.match(/\d+/)
      return match ? parseInt(match[0]) : null
    })
    .filter((n): n is number => n !== null)

  // Create a map to store number frequencies
  const frequencyMap = new Map<number, number>()

  // Count frequencies while maintaining first occurrence index
  for (const num of numbers) {
    frequencyMap.set(num, (frequencyMap.get(num) || 0) + 1)
  }

  let maxFreq = 0
  let result = 0
  let firstIndex = Infinity

  // Iterate through numbers to find most frequent
  // and break ties using original position
  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i]
    const freq = frequencyMap.get(num) || 0

    if (freq > maxFreq || (freq === maxFreq && i < firstIndex)) {
      maxFreq = freq
      result = num
      firstIndex = i
    }
  }

  return result
}
