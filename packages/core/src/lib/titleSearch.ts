// Reserve higher scores for exact, article-insensitive and substring title matches.
// Compare complete words for the fuzzy tier so a fragment inside a word is less likely to match.
export const MIN_TITLE_RELEVANCE = 0.5
export const titleRelevance = `CASE
  WHEN lower($1) IN (lower(title), lower(original_title)) THEN 4
  WHEN regexp_replace(lower($1), '^(the|an|a) +', '') IN (
    regexp_replace(lower(title), '^(the|an|a) +', ''),
    regexp_replace(lower(original_title), '^(the|an|a) +', '')
  ) THEN 3
  WHEN title ILIKE $2 OR original_title ILIKE $2 THEN 2
  WHEN $1 ~ '[[:alnum:]]{4}' THEN GREATEST(
    strict_word_similarity($1, title), strict_word_similarity($1, original_title)
  )
  ELSE 0
END`

export function literalTitlePattern(searchQuery: string): string {
  return `%${searchQuery.replace(/[\\%_]/g, '\\$&')}%`
}
