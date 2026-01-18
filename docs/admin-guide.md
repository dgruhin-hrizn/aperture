# Admin Guide

This guide covers initial setup, ongoing operations, and administrative configuration for Aperture.

---

## Getting Started

Start here if you're new to Aperture:

1. [Setup Wizard](admin/setup-wizard.md) — 11-step initial configuration
2. [Post-Setup Checklist](admin/post-setup-checklist.md) — Get recommendations running

### Platform-Specific Guides

| Platform | Guide |
|----------|-------|
| **Windows Docker Desktop** | [Windows Setup Guide](admin/windows-docker-desktop.md) — Docker Desktop + native Emby/Jellyfin |

### Advanced Deployment

| Topic | Guide |
|-------|-------|
| **External Database** | [External PostgreSQL](admin/external-database.md) — Use your own PostgreSQL server |

---

## Setup Configuration

### Media Server

| Topic | Description |
|-------|-------------|
| [Media Server Connection](admin/media-server.md) | Connect to Emby or Jellyfin |
| [Library Configuration](admin/libraries.md) | Select source libraries |
| [File Locations](admin/file-locations.md) | Path mappings for symlinks |

### External Integrations

| Integration | Description |
|-------------|-------------|
| [Integrations Overview](admin/integrations-overview.md) | Summary of all integrations |
| [Trakt](admin/trakt.md) | Rating sync, Discovery source |
| [TMDb](admin/tmdb.md) | Metadata enrichment |
| [OMDb](admin/omdb.md) | Rotten Tomatoes, Metacritic |
| [MDBList](admin/mdblist.md) | Curated lists, Top Picks source |
| [Jellyseerr](admin/jellyseerr.md) | Discovery requests |

---

## AI Configuration

### Provider & Models

| Topic | Description |
|-------|-------------|
| [AI Providers](admin/ai-providers.md) | OpenAI, Ollama, Groq, etc. |
| [Embedding Models](admin/embedding-models.md) | Model selection for vectors |
| [Text Generation Models](admin/text-models.md) | Model for explanations |
| [Chat Models](admin/chat-models.md) | Model for Encore assistant |

---

## AI Recommendations

### Output Configuration

| Topic | Description |
|-------|-------------|
| [Output Format](admin/output-format.md) | STRM vs Symlinks |
| [Library Title Templates](admin/library-titles.md) | Name patterns for libraries |

### AI Features

| Topic | Description |
|-------|-------------|
| [AI Explanations](admin/ai-explanations.md) | Generated "Why This Pick?" text |
| [Algorithm Tuning](admin/algorithm-tuning.md) | Weights and parameters |

---

## Feature Configuration

| Feature | Description |
|---------|-------------|
| [Top Picks](admin/top-picks.md) | Global trending libraries |
| [Shows You Watch](admin/shows-you-watch.md) | Track ongoing series |

---

## Background Jobs

### Job System

| Topic | Description |
|-------|-------------|
| [Jobs Overview](admin/jobs-overview.md) | How jobs work |
| [Job Scheduling](admin/job-scheduling.md) | Configure schedules |

### Job Reference

| Category | Description |
|----------|-------------|
| [Movie Jobs](admin/movie-jobs.md) | Sync, embeddings, recommendations |
| [Series Jobs](admin/series-jobs.md) | Sync, embeddings, recommendations |
| [Global Jobs](admin/global-jobs.md) | Enrichment, Top Picks, backups |

---

## User Management

| Topic | Description |
|-------|-------------|
| [User Management](admin/user-management.md) | Manage users and recommendations |
| [User Permissions](admin/user-permissions.md) | Per-user settings and overrides |

---

## System Administration

### Maintenance

| Topic | Description |
|-------|-------------|
| [Maintenance](admin/maintenance.md) | Poster repair, legacy cleanup |
| [Backup & Restore](admin/backup-restore.md) | Protect your data |
| [Database Management](admin/database-management.md) | Stats and purge |

### Troubleshooting

| Topic | Description |
|-------|-------------|
| [API Errors](admin/api-errors.md) | Error alerts and resolution |
| [Recommended Workflow](admin/recommended-workflow.md) | Best practices |

---

## Quick Reference

### Default Job Schedule

| Time | Jobs |
|------|------|
| 1:00 AM | Database backup |
| 2:00 AM | Library scan (sync-movies, sync-series) |
| Every 2h | Watch history sync |
| 3:00 AM | Embedding generation |
| Sunday 4:00 AM | AI recommendations |
| Sunday 5:00 AM | Library sync (STRM/symlinks) |
| 5:00 AM | Top Picks refresh |
| Every 6h | Metadata enrichment |
| Every 30m | User sync |

### Algorithm Defaults

| Weight | Movies | Series |
|--------|--------|--------|
| Similarity | 0.5 | 0.5 |
| Popularity | 0.2 | 0.2 |
| Recency | 0.1 | 0.1 |
| Rating | 0.1 | 0.1 |
| Diversity | 0.1 | 0.1 |

### Embedding Models

| Model | Dimensions | Cost |
|-------|------------|------|
| text-embedding-3-small | 1536 | $0.02/1M tokens |
| text-embedding-3-large | 3072 | $0.13/1M tokens |
| nomic-embed-text (Ollama) | 768 | Free (local) |

---

## Support

- [User Guide](user-guide.md) — End-user documentation
- [API Reference](api-reference.md) — Developer API docs
- [Release Notes](release-notes/) — Version history

---

## Document Index

All admin documentation files:

### Setup
- [admin/setup-wizard.md](admin/setup-wizard.md)
- [admin/post-setup-checklist.md](admin/post-setup-checklist.md)
- [admin/windows-docker-desktop.md](admin/windows-docker-desktop.md)
- [admin/media-server.md](admin/media-server.md)
- [admin/libraries.md](admin/libraries.md)
- [admin/file-locations.md](admin/file-locations.md)

### Integrations
- [admin/integrations-overview.md](admin/integrations-overview.md)
- [admin/trakt.md](admin/trakt.md)
- [admin/tmdb.md](admin/tmdb.md)
- [admin/omdb.md](admin/omdb.md)
- [admin/mdblist.md](admin/mdblist.md)
- [admin/jellyseerr.md](admin/jellyseerr.md)

### AI Configuration
- [admin/ai-providers.md](admin/ai-providers.md)
- [admin/embedding-models.md](admin/embedding-models.md)
- [admin/text-models.md](admin/text-models.md)
- [admin/chat-models.md](admin/chat-models.md)

### AI Recommendations
- [admin/output-format.md](admin/output-format.md)
- [admin/library-titles.md](admin/library-titles.md)
- [admin/ai-explanations.md](admin/ai-explanations.md)
- [admin/algorithm-tuning.md](admin/algorithm-tuning.md)

### Features
- [admin/top-picks.md](admin/top-picks.md)
- [admin/shows-you-watch.md](admin/shows-you-watch.md)

### Jobs
- [admin/jobs-overview.md](admin/jobs-overview.md)
- [admin/job-scheduling.md](admin/job-scheduling.md)
- [admin/movie-jobs.md](admin/movie-jobs.md)
- [admin/series-jobs.md](admin/series-jobs.md)
- [admin/global-jobs.md](admin/global-jobs.md)

### Users
- [admin/user-management.md](admin/user-management.md)
- [admin/user-permissions.md](admin/user-permissions.md)

### System
- [admin/maintenance.md](admin/maintenance.md)
- [admin/backup-restore.md](admin/backup-restore.md)
- [admin/database-management.md](admin/database-management.md)
- [admin/external-database.md](admin/external-database.md)
- [admin/api-errors.md](admin/api-errors.md)
- [admin/recommended-workflow.md](admin/recommended-workflow.md)
