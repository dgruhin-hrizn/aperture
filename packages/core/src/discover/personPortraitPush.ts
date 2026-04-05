/**
 * Resolve media-server Person item id from synced actors JSONB (personId field).
 */

import { queryOne } from '../lib/db.js'

/**
 * Return first non-empty personId from movies or series actors matching this display name.
 */
export async function findPersonMediaServerItemIdForName(
  decodedName: string
): Promise<string | null> {
  const fromMovies = await queryOne<{ pid: string }>(
    `SELECT trim(a->>'personId') AS pid
     FROM movies m
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.actors, '[]'::jsonb)) AS a
     WHERE trim(COALESCE(a->>'name', '')) != ''
     AND a->>'name' ILIKE $1
     AND a->>'personId' IS NOT NULL
     AND trim(a->>'personId') != ''
     LIMIT 1`,
    [decodedName]
  )
  if (fromMovies?.pid) {
    return fromMovies.pid
  }

  const fromSeries = await queryOne<{ pid: string }>(
    `SELECT trim(a->>'personId') AS pid
     FROM series s
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.actors, '[]'::jsonb)) AS a
     WHERE trim(COALESCE(a->>'name', '')) != ''
     AND a->>'name' ILIKE $1
     AND a->>'personId' IS NOT NULL
     AND trim(a->>'personId') != ''
     LIMIT 1`,
    [decodedName]
  )
  return fromSeries?.pid ?? null
}
