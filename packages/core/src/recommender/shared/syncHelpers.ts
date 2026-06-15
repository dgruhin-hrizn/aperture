/**
 * Shared helpers for media library sync (movies and series).
 */

/**
 * Clamp a rating value to fit within NUMERIC(5,2) column constraints (max 999.99)
 * Ratings from media servers should be 0-10 (community) or 0-100 (critic),
 * but bad metadata can sometimes have unexpected values
 */
export function clampRating(rating: number | null | undefined): number | null {
  if (rating === null || rating === undefined) return null
  // Clamp to valid range for NUMERIC(5,2) - max is 999.99
  return Math.min(Math.max(0, rating), 999.99)
}

/**
 * Fetch multiple pages in parallel
 */
export async function fetchParallel<T>(
  fetchFn: (startIndex: number, limit: number) => Promise<{ items: T[]; totalRecordCount: number }>,
  totalCount: number,
  pageSize: number,
  parallelFetches: number,
  onProgress?: (fetched: number) => void
): Promise<T[]> {
  const allItems: T[] = []
  const totalPages = Math.ceil(totalCount / pageSize)
  let currentPage = 0

  while (currentPage < totalPages) {
    const pagesToFetch = Math.min(parallelFetches, totalPages - currentPage)
    const fetchPromises: Promise<T[]>[] = []

    for (let i = 0; i < pagesToFetch; i++) {
      const startIndex = (currentPage + i) * pageSize
      fetchPromises.push(fetchFn(startIndex, pageSize).then((result) => result.items))
    }

    const results = await Promise.all(fetchPromises)
    for (const items of results) {
      allItems.push(...items)
    }

    currentPage += pagesToFetch
    onProgress?.(allItems.length)
  }

  return allItems
}

/**
 * Streaming batch processor for episodes
 * 
 * Instead of loading all episodes into memory, this fetches and processes
 * episodes in chunks. This is critical for very large libraries (200K+ episodes)
 * to avoid memory exhaustion.
 * 
 * @param fetchFn Function to fetch a page of episodes
 * @param totalCount Total number of episodes to process
 * @param pageSize Number of episodes per API request
 * @param processBatch Function to process a batch of episodes
 * @param onProgress Optional progress callback
 */
export async function streamingBatchProcess<T>(
  fetchFn: (startIndex: number, limit: number) => Promise<{ items: T[]; totalRecordCount: number }>,
  totalCount: number,
  pageSize: number,
  processBatch: (items: T[]) => Promise<{ added: number; updated: number }>,
  onProgress?: (processed: number, added: number, updated: number) => void
): Promise<{ totalProcessed: number; totalAdded: number; totalUpdated: number }> {
  let totalProcessed = 0
  let totalAdded = 0
  let totalUpdated = 0
  let startIndex = 0

  // Process one page at a time to minimize memory usage
  // For very large libraries, this trades some speed for reliability
  while (startIndex < totalCount) {
    // Fetch a single page
    const { items } = await fetchFn(startIndex, pageSize)
    
    if (items.length === 0) {
      break
    }

    // Process this batch immediately
    const result = await processBatch(items)
    totalAdded += result.added
    totalUpdated += result.updated
    totalProcessed += items.length

    onProgress?.(totalProcessed, totalAdded, totalUpdated)

    startIndex += items.length

    // Small yield to prevent blocking the event loop on very large libraries
    if (totalProcessed % 10000 === 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  return { totalProcessed, totalAdded, totalUpdated }
}
