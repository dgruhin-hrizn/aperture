# Aperture Support Questionnaire

Please fill out this questionnaire before posting a support request. This helps us diagnose your issue faster and reduces back-and-forth!

---

## 📋 Basic Information

**Aperture Version:** (e.g., v0.6.4 - check Admin → Dashboard or container logs)

**Platform:**

- [ ] Unraid
- [ ] Synology
- [ ] QNAP
- [ ] Linux/Docker
- [ ] Other: \***\*\_\_\_\*\***

**Media Server:**

- [ ] Emby
- [ ] Jellyfin

**Media Server Version:** \***\*\_\_\_\*\***

---

## 🔍 Issue Category

**What type of issue are you experiencing?**

- [ ] Initial Setup / Installation
- [ ] Recommendations not appearing / not working
- [ ] Libraries not showing in media server
- [ ] Jobs failing or stuck
- [ ] Symlinks / STRM files not working
- [ ] Top Picks not working
- [ ] Integration issues (OpenAI, Trakt, MDBList)
- [ ] Playback issues
- [ ] Performance / Database errors
- [ ] Other

---

## 🐛 Issue Description

**Describe the issue in detail:**

(What are you trying to do? What did you expect to happen? What actually happened?)

---

**When did this start happening?**

- [ ] Never worked (fresh install)
- [ ] After an update (from version **_ to _**)
- [ ] Suddenly stopped working
- [ ] Intermittent issue

---

## 🔧 Environment Details

### Docker Configuration

**Which docker-compose file are you using?**

- [ ] docker-compose.unraid.yml
- [ ] docker-compose.synology.yml
- [ ] docker-compose.qnap.yml
- [ ] docker-compose.prod.yml
- [ ] Custom configuration

**Have you modified the docker-compose file?** (If yes, describe changes)

**Volume Mounts** (please list your actual paths):

```
Aperture Libraries:  /your/path:/aperture-libraries
Media Library:       /your/path:/media
Backups:             /your/path:/backups
```

**Is your ApertureLibraries folder INSIDE your media share?**

- [ ] Yes (recommended)
- [ ] No (separate location)

---

### Path Configuration

**Aperture Libraries Path** (Admin → Settings → Setup → File Locations):

**Media Server Path Prefix** (Admin → Settings → Setup → File Locations):

**Have you run Auto-Detect Paths?**

- [ ] Yes, it succeeded
- [ ] Yes, but it failed
- [ ] No

**Sample path from your media server** (Emby/Jellyfin → Any movie → Media Info → Path):

---

### Output Format

**Movies output format:**

- [ ] Symlinks
- [ ] STRM files

**Series output format:**

- [ ] Symlinks
- [ ] STRM files

---

## 👥 User & Library Status

**Number of users enabled for AI recommendations:** \_\_\_

**Source libraries enabled:** (list your movie/TV library names)

**Do enabled users have watch history?**

- [ ] Yes
- [ ] No / Not sure

---

## 🤖 AI & Integrations

**OpenAI API Key configured?**

- [ ] Yes, test passed
- [ ] Yes, but test failed
- [ ] No

**Embedding model:**

- [ ] text-embedding-3-small
- [ ] text-embedding-3-large

**Have embeddings been generated?**

- [ ] Yes, for movies
- [ ] Yes, for series
- [ ] No / Partially
- [ ] Not sure

**Other integrations configured:**

- [ ] Trakt
- [ ] MDBList
- [ ] TMDb
- [ ] OMDb

---

## 📊 Job Status

**Have you run these jobs? (check all that apply)**

- [ ] sync-movies
- [ ] sync-series
- [ ] generate-movie-embeddings
- [ ] generate-series-embeddings
- [ ] sync-movie-watch-history
- [ ] sync-series-watch-history
- [ ] generate-movie-recommendations
- [ ] generate-series-recommendations
- [ ] sync-movie-libraries
- [ ] sync-series-libraries

**Are any jobs currently failing?** (If yes, which ones and what error?)

**Last successful recommendation generation:** (date/time if known)

---

## 📝 Error Messages

**Copy any error messages you see:**

```
(Paste errors from Admin → Jobs → Job History, or container logs)
```

**Are there any alerts showing in the Admin panel?**

- [ ] No alerts
- [ ] Yes: \***\*\_\_\_\*\***

---

## 🔄 What have you already tried?

- [ ] Restarted the Aperture container
- [ ] Restarted the media server
- [ ] Re-ran the failing job
- [ ] Checked container logs
- [ ] Verified volume mount paths
- [ ] Tested API connections (OpenAI, media server)
- [ ] Ran Auto-Detect Paths
- [ ] Rescanned libraries in media server
- [ ] Other: \***\*\_\_\_\*\***

---

## 📸 Screenshots / Logs

**Please attach (if applicable):**

- Screenshot of the error
- Screenshot of Admin → Settings → Setup (with API keys hidden)
- Relevant container logs (last 50-100 lines)

**To get container logs:**

```bash
docker logs aperture --tail 100
```

---

## 💡 Additional Context

(Anything else that might be helpful - recent changes, other containers, network setup, etc.)

---

## Common Issues & Quick Fixes

Before posting, check if your issue matches one of these:

### "Libraries not appearing in Emby/Jellyfin"

1. Verify ApertureLibraries folder is inside your media share
2. Run Auto-Detect Paths in Admin → Settings → Setup
3. Run sync-movie-libraries / sync-series-libraries jobs
4. Rescan libraries in your media server

### "Recommendations empty or not generated"

1. Ensure users are enabled for recommendations (Admin → Users)
2. Verify users have watch history
3. Run jobs in order: sync → embeddings → watch history → recommendations → library sync

### "Symlinks not working / Path does not exist"

1. Both containers must see the same underlying filesystem
2. Run Auto-Detect Paths to fix path mappings
3. Check that Media Server Path Prefix matches how Emby/Jellyfin sees your files

### "OpenAI errors"

1. Verify API key is valid at platform.openai.com
2. Check you have credits/billing set up
3. Test connection in Admin → Settings → Integrations

### "Jobs stuck or taking forever"

1. Large libraries take time on first sync (check progress in job details)
2. Embedding generation: ~1-2 seconds per movie
3. If truly stuck, cancel and restart the job

---

**Thank you for filling this out!** The more detail you provide, the faster we can help. 🍿
