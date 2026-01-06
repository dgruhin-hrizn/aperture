/**
 * Weighted random sampling - picks items with probability proportional to their weight
 */
export function weightedRandomSample<T extends { score: number }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return items

  const selected: T[] = []
  const remaining = [...items]

  // Normalize scores to be positive weights (similarity scores are typically 0-1)
  // Square the scores to give higher-scored items more weight while still allowing variety
  const getWeight = (score: number) => Math.pow(Math.max(0.1, score), 2)

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + getWeight(item.score), 0)
    let random = Math.random() * totalWeight

    for (let j = 0; j < remaining.length; j++) {
      random -= getWeight(remaining[j].score)
      if (random <= 0) {
        selected.push(remaining[j])
        remaining.splice(j, 1)
        break
      }
    }
  }

  // Sort selected by score descending for a nice order in the playlist
  return selected.sort((a, b) => b.score - a.score)
}


