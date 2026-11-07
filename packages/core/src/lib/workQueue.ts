/** A FIFO limit shared by callers; failures always release their slot. */
export class WorkQueue {
  private active = 0
  private readonly waiting: Array<() => void> = []

  constructor(private readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error('Invalid concurrency limit')
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    } else {
      this.active++
    }
    try {
      return await task()
    } finally {
      const next = this.waiting.shift()
      if (next) next()
      else this.active--
    }
  }
}
