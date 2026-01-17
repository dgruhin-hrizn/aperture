# Watcher Identity

Watcher Identity is an advanced settings section that shows your computed taste profile and allows fine-tuning of how your viewing history influences recommendations.

## Accessing Watcher Identity

1. Click your avatar in the top navigation bar
2. Select **Settings**
3. Click the **Watcher Identity** tab

---

## Overview

Watcher Identity analyzes your watch history to build a profile of your viewing preferences. This profile influences AI recommendations.

### Components

| Component | Purpose |
|-----------|---------|
| **Identity Profiles** | Abstract taste descriptions |
| **Franchise Weights** | Influence of specific franchises |
| **Genre Weights** | Influence of specific genres |
| **History Sources** | Which libraries to consider |

---

## Identity Profiles

### What They Are

AI-generated descriptions of your movie and series taste based on embedding analysis.

### Movie Identity

Example profile:

> "You gravitate toward complex narratives with unreliable narrators, particularly psychological thrillers and mind-bending science fiction. You appreciate auteur directors who prioritize visual storytelling and subvert genre conventions."

### Series Identity

Example profile:

> "You prefer serialized dramas with morally ambiguous protagonists and long-form character development. You enjoy shows that reward attention to detail and build toward satisfying conclusions."

### Regenerating Profiles

Click **Analyze Watch History** to regenerate your identity:

1. Analyzes your recent watch history
2. Uses AI embeddings to find patterns
3. Generates new taste description
4. Updates franchise and genre weights

**When to regenerate:**
- After watching significant new content
- After rating many items
- If recommendations feel off
- Periodically (monthly or quarterly)

---

## Franchise Weights

### What They Show

Franchises detected from your watch history with their influence level:

| Franchise | Weight | Meaning |
|-----------|--------|---------|
| Marvel Cinematic Universe | 0.8 | Strong influence |
| Star Wars | 0.5 | Moderate influence |
| James Bond | 0.3 | Mild influence |

### How Weights Work

- **Higher weight** = More influence on recommendations
- **Lower weight** = Less influence
- **Weight of 0** = Franchise excluded

### Adjusting Weights

1. Find the franchise
2. Use the slider to adjust (0-1 scale)
3. Changes save automatically

### Deleting Franchises

Click the **X** next to any franchise to remove it from consideration:

- Franchise won't influence recommendations
- Won't affect your actual watch history
- Can be re-added by regenerating profile

### Use Cases

| Goal | Action |
|------|--------|
| Too many Marvel recommendations | Lower MCU weight |
| Done with a franchise | Set weight to 0 or delete |
| Want more of a series | Increase its weight |
| Franchise was a one-time watch | Delete it |

---

## Genre Weights

### What They Show

Genres detected from your watch history with their influence:

| Genre | Weight | Watch Count |
|-------|--------|-------------|
| Science Fiction | 0.9 | 45 movies |
| Action | 0.7 | 32 movies |
| Drama | 0.6 | 28 movies |
| Comedy | 0.4 | 18 movies |

### How Genre Weights Work

Genres you watch more get higher weights automatically, but you can adjust:

- **Override high genres** — Lower weight if getting too many
- **Boost low genres** — Increase weight to see more
- **Suppress genres** — Set to 0 to exclude

### Adjusting Weights

1. Find the genre
2. Use the slider to adjust
3. Changes save automatically

### Deleting Genres

Click the **X** to remove a genre:

- That genre won't influence recommendations
- Content in that genre still appears (just not prioritized)
- Useful for genres you watched but don't want more of

---

## Watch History Sources

### What This Controls

Which libraries are considered when analyzing your watch history.

### Default Behavior

All your standard libraries are included:

- Movies
- TV Shows
- Custom libraries

### Excluding Libraries

You may want to exclude:

| Library | Why Exclude |
|---------|-------------|
| Kids library | Different taste than yours |
| Shared library | Contains others' watches |
| Documentary library | Want entertainment focus |

### Setting Exclusions

1. View the list of libraries
2. Toggle off libraries to exclude
3. Only toggled-on libraries affect your profile

### Effect of Exclusions

- Excluded library watches don't influence recommendations
- Excluded content can still be recommended
- Your taste profile is more focused

---

## Minimum Franchise Items

### What It Does

Sets the minimum number of items watched to consider a franchise.

### Example

If set to 3:
- Watched 2 Marvel movies → Marvel not in franchise weights
- Watched 3+ Marvel movies → Marvel appears in franchise weights

### Why Adjust

| Setting | Effect |
|---------|--------|
| **Lower (1-2)** | More franchises detected, some may be noise |
| **Default (3)** | Balanced detection |
| **Higher (5+)** | Only strong franchise engagement detected |

---

## Reset Options

### Reset Franchise Weights

Returns all franchise weights to auto-calculated values.

### Reset Genre Weights

Returns all genre weights to auto-calculated values.

### Reset All Identity

Clears your entire identity profile:

- Removes all franchises and genres
- Clears identity descriptions
- Next analysis rebuilds from scratch

**Warning:** This starts your taste profile over. Use when recommendations have diverged significantly from your preferences.

---

## Tips

### Regular Maintenance

- Regenerate profile every few months
- Adjust weights when recommendations drift
- Remove franchises you're done with

### Troubleshooting Bad Recommendations

1. Check franchise weights for overrepresented series
2. Look for genres that are weighted too high
3. Verify correct libraries are included
4. Regenerate your profile

### Shared Accounts

If multiple people use your account:

- Exclude libraries used by others
- Weights may reflect blended taste
- Consider separate accounts for personalization

---

**Next:** [Trakt Integration](../trakt-integration.md)
