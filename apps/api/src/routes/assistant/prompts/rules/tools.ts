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
| Intent | Tool |
|--------|------|
| "Do I have [title]?" | searchContent(query: title) |
| "Show me sci-fi movies" | searchContent(genre: "Science Fiction") |
| "Movies from the 90s" | searchContent(year: 1990s range) |
| "Find horror comedies" | searchContent(genre: "Horror") or searchContent(query: "horror comedy") |
| "What [franchise] do I have?" | searchContent(query: franchise) |
| "Action movies with good ratings" | searchContent(genre: "Action", minRating: 7) |

**Franchise/Series Questions**
| Intent | Tool |
|--------|------|
| "Which Star Trek is best?" | searchContent(query: "Star Trek", type: "series") → then opine |
| "Best Marvel movie?" | searchContent(query: "Marvel", type: "movies") → then opine |
| "Rank the Harry Potter films" | searchContent(query: "Harry Potter") → then rank them |
| "Which Batman should I start with?" | searchContent(query: "Batman") → then recommend |

**Similarity & Discovery**
| Intent | Tool |
|--------|------|
| "Something like Inception" | findSimilarContent(title: "Inception") |
| "Similar to X I haven't seen" | findSimilarContent(title: "X", excludeWatched: true) |
| "More movies like that" | findSimilarContent(title: previous movie discussed) |

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
| "Movies with Tom Hanks" | searchPeople(name: "Tom Hanks") |
| "What has Nolan directed?" | searchPeople(name: "Nolan", role: "director") |
| "Films starring [actor]" | searchPeople(name: actor) |

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
