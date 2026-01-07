/**
 * Schema for a content item (movie or series) in Tool UI format
 */
import { z } from 'zod'

// Action button schema
export const ActionSchema = z.object({
  id: z.string().describe('Unique action identifier'),
  label: z.string().describe('Button label text'),
  href: z.string().optional().describe('URL for the action'),
  variant: z.enum(['default', 'secondary', 'primary']).optional().describe('Button style variant'),
})

// Content item schema matching Tool UI ItemCarousel format
export const ContentItemSchema = z.object({
  id: z.string().describe('Unique content ID'),
  type: z.enum(['movie', 'series']).describe('Content type'),
  name: z.string().describe('Title of the content'),
  subtitle: z.string().optional().describe('Year, genres, or other info'),
  image: z.string().nullable().optional().describe('Poster image URL'),
  rating: z.number().nullable().optional().describe('Community rating 0-10'),
  userRating: z.number().nullable().optional().describe('User rating 1-10'),
  rank: z.number().optional().describe('Recommendation rank'),
  actions: z.array(ActionSchema).optional().describe('Action buttons'),
})

export type ContentItem = z.infer<typeof ContentItemSchema>
export type Action = z.infer<typeof ActionSchema>

