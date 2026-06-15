import { useCallback, useRef } from 'react'

export function useStripLoadQueue(processItem: (key: string) => Promise<void>) {
  const queueRef = useRef<string[]>([])
  const processingRef = useRef(false)
  const queuedRef = useRef<Set<string>>(new Set())
  const processItemRef = useRef(processItem)
  processItemRef.current = processItem

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    const key = queueRef.current.shift()
    if (!key) return
    processingRef.current = true
    queuedRef.current.delete(key)

    try {
      await processItemRef.current(key)
    } finally {
      processingRef.current = false
      void processQueue()
    }
  }, [])

  const enqueue = useCallback(
    (key: string, canEnqueue: () => boolean) => {
      if (!canEnqueue()) return
      if (queuedRef.current.has(key)) return
      queuedRef.current.add(key)
      queueRef.current.push(key)
      void processQueue()
    },
    [processQueue]
  )

  const reset = useCallback(() => {
    queueRef.current = []
    queuedRef.current = new Set()
    processingRef.current = false
  }, [])

  return { enqueue, reset }
}
