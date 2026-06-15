export interface Movie {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
}

export interface Series {
  id: string
  title: string
  year: number | null
  genres: string[]
  overview: string | null
  poster_url: string | null
  community_rating: number | null
  network: string | null
  status: string | null
  total_seasons: number | null
}

export interface Collection {
  name: string
  count: number
}

export interface ContentRating {
  rating: string
  count: number
}

export interface Resolution {
  resolution: string
  count: number
}

export interface CountryOption {
  country: string
  count: number
}

export interface FilterRanges {
  year: { min: number; max: number }
  runtime?: { min: number; max: number }
  seasons?: { min: number; max: number }
  rating: { min: number; max: number }
}

export interface BrowsePerson {
  name: string
  credits: number
  movieCredits: number
  seriesCredits: number
}

export interface ActiveFilterChip {
  label: string
  onDelete: () => void
}
