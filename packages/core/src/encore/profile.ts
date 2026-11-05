import { query, queryOne } from '../lib/db.js'

export async function getEncoreTaste(userId: string) {
  const [synopsis, genres, franchises, interests] = await Promise.all([
    queryOne<{ taste_synopsis: string | null; series_taste_synopsis: string | null }>(
      'SELECT taste_synopsis, series_taste_synopsis FROM user_preferences WHERE user_id = $1',
      [userId]
    ),
    query(
      'SELECT genre, weight, is_user_set FROM user_genre_weights WHERE user_id = $1 ORDER BY weight DESC LIMIT 30',
      [userId]
    ),
    query(
      'SELECT franchise_name, preference_score, is_user_set FROM user_franchise_preferences WHERE user_id = $1 ORDER BY preference_score DESC LIMIT 20',
      [userId]
    ),
    query(
      'SELECT id, interest_text, weight FROM user_custom_interests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
      [userId]
    ),
  ])
  return {
    kind: 'taste' as const,
    movieTaste: synopsis?.taste_synopsis ?? null,
    seriesTaste: synopsis?.series_taste_synopsis ?? null,
    genres: genres.rows,
    franchises: franchises.rows,
    interests: interests.rows,
  }
}
