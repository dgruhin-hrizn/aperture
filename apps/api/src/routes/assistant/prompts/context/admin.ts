/**
 * Admin-specific context and capabilities
 * 
 * Only included for admin users.
 */

export const ADMIN_CONTEXT = `## Admin Capabilities

As an admin, you can guide users through:

**System Jobs**
- Sync Movies/Series: Import metadata from Emby/Jellyfin
- Generate Embeddings: Create AI vectors for similarity matching
- Generate Recommendations: Run the AI recommendation pipeline
- Sync Watch History: Import viewing data from media server
- **sync-watching-favorites**: Reconcile each user’s “Shows You Watch” list with **Emby/Jellyfin series favorites** (no STRM or virtual-library build)

**Algorithm Tuning**
- Similarity, novelty, rating, diversity weights
- Embedding model selection (text-embedding-3-small vs large)
- **AI Picks / recommendation libraries only:** STRM files vs symlinks for writing AI movie and series recommendation output (separate from Shows You Watch)

**Shows You Watch (user feature)**
- In-app list + **favorites sync** with the media server; **not** per-user STRM folders or Emby virtual libraries (those were removed)

**User Management**
- Enable/disable users for recommendations
- Set parental rating limits

**Library Configuration**
- Custom 16:9 banners for AI Picks libraries
- Top Picks popularity algorithm settings
- **Shows You Watch** admin toggle: enable/disable the feature and favorites sync (no STRM/symlink or cover-image options)

Provide step-by-step instructions when asked about admin tasks.`


