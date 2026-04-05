/**
 * Choose a YouTube trailer/teaser from TMDb /movie/{id}/videos or /tv/{id}/videos results.
 */
import type { TMDbVideo } from './types.js'

export function pickBestYoutubeTrailer(
  videos: TMDbVideo[]
): { trailerUrl: string; name: string; site: string } | null {
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key)
  const officialTrailer = youtube.find((v) => v.type === 'Trailer' && v.official)
  const anyTrailer = youtube.find((v) => v.type === 'Trailer')
  const teaser = youtube.find((v) => v.type === 'Teaser')
  const picked = officialTrailer || anyTrailer || teaser
  if (!picked) return null
  return {
    trailerUrl: `https://www.youtube.com/watch?v=${picked.key}`,
    name: picked.name,
    site: picked.site,
  }
}
