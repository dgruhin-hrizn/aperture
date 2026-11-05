import { query } from './scopedDb.js'
import { curationRecipe, type CurationRecipe } from './curationSchemas.js'
import { createEncoreTools } from './toolkit.js'
import { resolveEncoreItems } from './liveItems.js'
import type { ToolContext } from './types.js'
export async function selectEncoreCurationItems(ctx: ToolContext, input: CurationRecipe) {
  const recipe = curationRecipe.parse(input)
  let ids: Array<{ id: string; type: 'movie' | 'episode' }>
  if (recipe.concept && recipe.mediaType === 'movies') {
    const tool = createEncoreTools(ctx, ['library:read', 'profile:read']).semanticSearch
    const output = (await tool.execute!(
      {
        concept: recipe.concept,
        type: 'movies',
        genre: recipe.genre,
        maxRuntime: recipe.maxRuntime,
        minRating: recipe.minRating,
        excludeWatched: recipe.excludeWatched,
        limit: 50,
      } as never,
      { toolCallId: 'curation-selection', messages: [], context: undefined }
    )) as {
      items?: Array<{ id: string }>
      error?: string
      descriptionKey?: string
      descriptionParams?: { message?: string }
    }
    if (output.descriptionKey === 'carouselSemanticError')
      throw new Error(output.descriptionParams?.message ?? 'Semantic curation failed')
    if (output.error || !Array.isArray(output.items))
      throw new Error(output.error ?? 'Semantic curation returned no verifiable result')
    ids = output.items.map((item) => ({ id: item.id, type: 'movie' }))
  } else if (recipe.mediaType === 'movies') {
    ids = (
      await query<{ id: string; type: 'movie' }>(
        `SELECT id,'movie'::text type FROM movies m WHERE ($1::text IS NULL OR EXISTS(SELECT 1 FROM unnest(m.genres) genre WHERE lower(genre)=lower($1)))
      AND ($2::int IS NULL OR m.runtime_minutes<=$2) AND ($3::numeric IS NULL OR m.community_rating>=$3)
      AND (NOT $4::boolean OR NOT EXISTS(SELECT 1 FROM watch_history wh WHERE wh.user_id=$5 AND wh.movie_id=m.id))
      ORDER BY m.community_rating DESC NULLS LAST,m.id LIMIT 50`,
        [
          recipe.genre ?? null,
          recipe.maxRuntime ?? null,
          recipe.minRating ?? null,
          recipe.excludeWatched,
          ctx.userId,
        ]
      )
    ).rows
  } else {
    ids = (
      await query<{ id: string; type: 'episode' }>(
        `SELECT e.id,'episode'::text type FROM episodes e JOIN series s ON s.id=e.series_id WHERE s.id=$1
      AND ($6::text IS NULL OR EXISTS(SELECT 1 FROM unnest(s.genres) genre WHERE lower(genre)=lower($6)))
      AND ($2::int IS NULL OR e.runtime_minutes<=$2) AND ($3::numeric IS NULL OR e.community_rating>=$3)
      AND (NOT $4::boolean OR NOT EXISTS(SELECT 1 FROM watch_history wh WHERE wh.user_id=$5 AND wh.episode_id=e.id))
      ORDER BY e.season_number,e.episode_number LIMIT 50`,
        [
          recipe.seriesId,
          recipe.maxRuntime ?? null,
          recipe.minRating ?? null,
          recipe.excludeWatched,
          ctx.userId,
          recipe.genre ?? null,
        ]
      )
    ).rows
  }
  if (!ids.length) return []
  const actual = await resolveEncoreItems(ctx.userId, ids, !recipe.excludeWatched)
  return actual
    .filter(
      (item) =>
        !item.reason &&
        (!recipe.maxRuntime || Boolean(item.minutes && item.minutes <= recipe.maxRuntime))
    )
    .slice(0, recipe.limit)
    .map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      providerId: item.providerId,
    }))
}
