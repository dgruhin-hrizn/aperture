/**
 * Schema for person search results (actors, directors, writers)
 */
import { z } from 'zod'

// Filmography item
export const FilmographyItemSchema = z.object({
  id: z.string().describe('Content ID'),
  type: z.enum(['movie', 'series']).describe('Content type'),
  title: z.string().describe('Title'),
  year: z.number().nullable().optional().describe('Release year'),
  role: z.string().nullable().optional().describe('Role played (for actors)'),
})

// Person schema
export const PersonSchema = z.object({
  name: z.string().describe('Person name'),
  role: z.enum(['actor', 'director', 'writer']).describe('Person role'),
  thumb: z.string().nullable().optional().describe('Profile thumbnail URL'),
  filmography: z.array(FilmographyItemSchema).describe('Their movies and series'),
})

// Person results schema
export const PersonResultSchema = z.object({
  id: z.string().describe('Unique result ID'),
  people: z.array(PersonSchema).describe('Found people'),
})

export type FilmographyItem = z.infer<typeof FilmographyItemSchema>
export type Person = z.infer<typeof PersonSchema>
export type PersonResult = z.infer<typeof PersonResultSchema>


