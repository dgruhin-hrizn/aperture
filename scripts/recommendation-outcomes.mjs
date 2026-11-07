import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
const days = Number(process.argv[2] ?? 30)
if (!process.env.DATABASE_URL || !Number.isInteger(days) || days < 1 || days > 180) {
  throw new Error('Set DATABASE_URL and optionally pass a window from 1 to 180 days.')
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
try {
  await db.connect()
  await db.query('BEGIN READ ONLY')
  await db.query("SET LOCAL statement_timeout = '15s'")
  const { rows } = await db.query(`
    WITH picks AS (
      SELECT DISTINCT ON (r.user_id, r.media_type, COALESCE(c.movie_id, c.series_id))
        r.user_id, r.media_type, c.movie_id, c.series_id, r.completed_at AS suggested_at
      FROM recommendation_runs r JOIN recommendation_candidates c ON c.run_id = r.id
      WHERE r.status = 'completed' AND c.is_selected
        AND r.completed_at >= now() - make_interval(days => $1)
        AND COALESCE(c.movie_id, c.series_id) IS NOT NULL
      ORDER BY r.user_id, r.media_type, COALESCE(c.movie_id, c.series_id), r.completed_at
    ), observations AS (
      SELECT p.media_type, bool_or(w.id IS NOT NULL) AS started,
             bool_or(w.played OR w.play_count > 0) AS completed
      FROM picks p LEFT JOIN watch_history w
        ON w.user_id = p.user_id AND w.movie_id = p.movie_id AND w.last_played_at > p.suggested_at
      WHERE p.media_type = 'movie'
      GROUP BY p.media_type, p.user_id, p.movie_id
      UNION ALL
      SELECT p.media_type, bool_or(w.last_played_at > p.suggested_at) AS started,
             (bool_or(w.last_played_at > p.suggested_at)
               AND count(e.id) > 0 AND bool_and(COALESCE(w.played OR w.play_count > 0, false))) AS completed
      FROM picks p LEFT JOIN episodes e ON e.series_id = p.series_id AND e.season_number > 0
      LEFT JOIN watch_history w ON w.user_id = p.user_id AND w.episode_id = e.id
      WHERE p.media_type = 'series'
      GROUP BY p.media_type, p.user_id, p.series_id
    )
    SELECT media_type, count(*)::int AS suggested,
      count(*) FILTER (WHERE started)::int AS started,
      count(*) FILTER (WHERE completed)::int AS completed
    FROM observations GROUP BY media_type ORDER BY media_type
  `, [days])
  console.table(rows)
  console.log(`Observation window is ${days} days. Observed plays after a saved pick, whether or not it was shown. TV completion covers the currently imported regular episodes.`)
} finally {
  await db.end()
}
