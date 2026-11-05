export interface SemanticFilters { genre?: string; maxRuntime?: number; minRating?: number; yearMin?: number; yearMax?: number; excludeWatched?: boolean; contentRating?: string }
export function semanticFilters(alias: 'm' | 's', values: unknown[], input: SemanticFilters, userId: string) {
  const conditions: string[] = []
  const add = (value: unknown) => { values.push(value); return `$${values.length}` }
  if (input.genre) conditions.push(`EXISTS (SELECT 1 FROM unnest(${alias}.genres) genre WHERE genre ILIKE ${add(input.genre)})`)
  if (input.yearMin) conditions.push(`${alias}.year >= ${add(input.yearMin)}`)
  if (input.yearMax) conditions.push(`${alias}.year <= ${add(input.yearMax)}`)
  if (input.minRating !== undefined) conditions.push(`${alias}.community_rating >= ${add(input.minRating)}`)
  if (input.contentRating) conditions.push(`${alias}.content_rating ILIKE ${add(input.contentRating)}`)
  if (input.maxRuntime) conditions.push(`${alias === 'm' ? 'm.runtime_minutes' : '(SELECT AVG(ep.runtime_minutes) FROM episodes ep WHERE ep.series_id = s.id)'} <= ${add(input.maxRuntime)}`)
  if (input.excludeWatched) conditions.push(alias === 'm'
    ? `NOT EXISTS (SELECT 1 FROM watch_history wh WHERE wh.movie_id = m.id AND wh.user_id = ${add(userId)})`
    : `NOT EXISTS (SELECT 1 FROM watch_history wh JOIN episodes ep ON ep.id = wh.episode_id WHERE ep.series_id = s.id AND wh.user_id = ${add(userId)})`)
  return conditions.length ? `AND ${conditions.join(' AND ')}` : ''
}
