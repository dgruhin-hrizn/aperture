/**
 * Schema for a carousel of content items
 */
import { z } from 'zod'
import { ContentItemSchema } from './contentItem.js'

// Content carousel schema matching Tool UI ItemCarousel format
export const ContentCarouselSchema = z.object({
  id: z.string().describe('Unique carousel ID'),
  title: z.string().optional().describe('Carousel heading'),
  description: z.string().optional().describe('Optional description'),
  items: z.array(ContentItemSchema).describe('Content items to display'),
})

export type ContentCarousel = z.infer<typeof ContentCarouselSchema>

// Helper to create a carousel result
export function createCarouselResult(
  id: string,
  items: z.infer<typeof ContentItemSchema>[],
  title?: string,
  description?: string
): z.infer<typeof ContentCarouselSchema> {
  return {
    id,
    title,
    description,
    items,
  }
}


