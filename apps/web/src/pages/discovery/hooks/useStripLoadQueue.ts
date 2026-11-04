import { useEffect, useRef } from 'react'
import { createStripQueue } from './stripQueue'

export function useStripLoadQueue(
  processItem: (key: string, signal: AbortSignal) => Promise<void>
) {
  const processRef = useRef(processItem)
  processRef.current = processItem
  const queueRef = useRef<ReturnType<typeof createStripQueue>>()
  if (!queueRef.current)
    queueRef.current = createStripQueue((key, signal) => processRef.current(key, signal))
  const queue = queueRef.current
  useEffect(() => () => queue.reset(), [queue])
  return queue
}
