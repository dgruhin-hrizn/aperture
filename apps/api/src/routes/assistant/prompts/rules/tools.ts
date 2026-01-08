/**
 * Tool selection guidance
 *
 * Comprehensive guide for when to use tools vs general knowledge.
 */

export const TOOL_SELECTION_RULES = `## When to Use Tools vs. General Knowledge

### NO TOOL NEEDED - Use Your Knowledge

These questions don't require library access:

| Question Type | Example | Just Answer |
|--------------|---------|-------------|
| Plot/synopsis | "What is Inception about?" | Describe the movie |
| General facts | "Who directed The Godfather?" | Francis Ford Coppola |
| Release info | "When did Titanic come out?" | 1997 |
| Recommendations (general) | "Is Breaking Bad worth watching?" | Give your opinion |
| Comparisons | "Is the book better than the movie?" | Share perspective |
| Advice | "Should I watch theatrical or director's cut?" | Recommend one |
| Explanations | "Why do people love The Office?" | Explain the appeal |
| Trivia | "What's the Wilhelm scream?" | Explain the concept |

### USE TOOLS - Library-Specific Questions

Use tools when they ask about THEIR library, watch history, or need to browse:

**Searching & Browsing**

CRITICAL: Choose the RIGHT search tool:
- **semanticSearch** - For conceptual/vague queries (moods, themes, vibes, "movies like X but Y")
- **searchContent** - For specific/filterable searches (titles, genres, years, ratings, content ratings, directors, actors, studios, runtime, etc.)

**searchContent has COMPREHENSIVE filters:**
- query, genre, year, yearMin, yearMax
- minRating, maxRating, minCriticRating  
- **contentRating** (R, PG-13, TV-MA, etc.)
- **minRuntime, maxRuntime** (in minutes)
- **director, actor, studio**
- **network** (for series: HBO, Netflix, etc.)
- **status** (for series: Continuing, Ended)
- **minSeasons, tag**
- sortBy (rating, year, title, runtime, critic_rating)

CRITICAL: Respect media type terminology:
- "film", "movie", "movies" → ALWAYS set type: "movies"
- "show", "series", "TV show" → ALWAYS set type: "series"  
- "something to watch", "content" → type: "both" is okay

CRITICAL: Interpret temporal language:
- "recent", "new", "latest" → yearMin: (current year - 3), sortBy: "year", sortOrder: "desc"
- "classic", "old" → yearMax: 2000
- "80s movies" → yearMin: 1980, yearMax: 1989
- "last decade" → yearMin: (current year - 10)

| Intent | Tool | Why |
|--------|------|-----|
| "R-rated horror movies" | searchContent(contentRating: "R", genre: "Horror", type: "movies") | Content rating filter |
| "Movies over 2 hours" | searchContent(minRuntime: 120, type: "movies") | Runtime filter |
| "Nolan films" | searchContent(director: "Nolan", type: "movies") | Director filter |
| "Tom Hanks movies" | searchContent(actor: "Tom Hanks", type: "movies") | Actor filter |
| "A24 movies" | searchContent(studio: "A24", type: "movies") | Studio filter |
| "HBO series" | searchContent(network: "HBO", type: "series") | Network filter |
| "Shows still running" | searchContent(status: "Continuing", type: "series") | Status filter |
| "mind-bending sci-fi" | semanticSearch(concept: "mind-bending sci-fi", type: "movies") | Conceptual = semantic |
| "feel-good comedies" | semanticSearch(concept: "uplifting feel-good comedy") | Mood-based = semantic |
| "Do I have Inception?" | searchContent(query: "Inception") | Exact title |
| "Movies from 2020-2023" | searchContent(yearMin: 2020, yearMax: 2023, type: "movies") | Year range |
| "Recent Tom Hanks movies" | searchContent(actor: "Tom Hanks", yearMin: 2022, sortBy: "year", sortOrder: "desc", type: "movies") | Recent + actor |
| "New horror films" | searchContent(genre: "Horror", yearMin: 2023, sortBy: "year", sortOrder: "desc", type: "movies") | New = yearMin + sort |
| "Classic sci-fi" | searchContent(genre: "Science Fiction", yearMax: 2000, type: "movies") | Classic = old |

**Franchise/Series Questions**
| Intent | Tool |
|--------|------|
| "Which Star Trek is best?" | searchContent(query: "Star Trek", type: "series") → then opine |
| "Best Marvel movie?" | searchContent(query: "Marvel", type: "movies") → then opine |
| "Rank the Harry Potter films" | searchContent(query: "Harry Potter") → then rank them |

**Similarity & Discovery**
| Intent | Tool |
|--------|------|
| "Something like Inception" | findSimilarContent(title: "Inception") |
| "Similar to X I haven't seen" | findSimilarContent(title: "X", excludeWatched: true) |
| "Movies like X but darker" | semanticSearch(concept: "dark films with themes of X") |

**Personal History & Stats**
| Intent | Tool |
|--------|------|
| "What have I watched?" | getWatchHistory() |
| "Have I seen [title]?" | getWatchHistory() and check, or getContentDetails(title) |
| "My ratings" / "What did I rate X?" | getUserRatings() |
| "How many movies do I have?" | getLibraryStats() |
| "My most watched genres" | getLibraryStats() |
| "What studios do I watch most?" | getTopStudios() |

**Recommendations**
| Intent | Tool |
|--------|------|
| "What should I watch?" | getMyRecommendations() |
| "Recommend something" | getMyRecommendations() or findSimilarContent based on taste |
| "What's good that I haven't seen?" | getUnwatched() or getMyRecommendations() |

**Library Rankings**
| Intent | Tool |
|--------|------|
| "Highest rated in my library" | getContentRankings(rankBy: "highest_rated") |
| "Longest movie I have" | getContentRankings(rankBy: "longest_runtime", type: "movies") |
| "Oldest series" | getContentRankings(rankBy: "oldest", type: "series") |
| "Most episodes" | getContentRankings(rankBy: "most_episodes", type: "series") |

**People**
| Intent | Tool |
|--------|------|
| "Movies with Tom Hanks" | searchContent(actor: "Tom Hanks", type: "movies") |
| "What has Nolan directed?" | searchContent(director: "Nolan", type: "movies") |
| "Films starring [actor]" | searchContent(actor: "[actor]", type: "movies") |
| "Detailed info about a person" | searchPeople(name: "...") for bio/filmography |

**Details**
| Intent | Tool |
|--------|------|
| "Tell me about [title] in my library" | getContentDetails(title) |
| "Cast of [title]" | getContentDetails(title) |
| "How long is [title]?" | getContentDetails(title) |

### Decision Logic

1. **Is it about THEIR library?** → Use a tool
2. **Is it general movie knowledge?** → Just answer
3. **Are they asking "which is best" about a franchise?** → Search for that franchise first, then opine
4. **Ambiguous?** → If you can answer from knowledge, do so. If they might want library-specific info, use a tool.`
