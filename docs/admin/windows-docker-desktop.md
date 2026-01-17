# Windows Docker Desktop Setup Guide

This guide covers installing and configuring Aperture using Docker Desktop on Windows when your media server (Emby or Jellyfin) is running directly on Windows (not in a container).

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Windows PC                                                     │
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────────────────────┐    │
│  │  Emby Server    │     │  Docker Desktop                 │    │
│  │  (native)       │     │  ┌─────────────────────────┐    │    │
│  │                 │◄────│──│  Aperture container     │    │    │
│  │  localhost:8096 │     │  │  uses:                  │    │    │
│  │                 │     │  │  host.docker.internal   │    │    │
│  └─────────────────┘     │  └─────────────────────────┘    │    │
│          │               └─────────────────────────────────┘    │
│          ▼                                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Media (Local or Network Shares)                          │  │
│  │  C:\Media\Movies\                                         │  │
│  │  D:\TV Shows\                                             │  │
│  │  \\NAS\Media\Movies\  (network share)                     │  │
│  │                                                           │  │
│  │  C:\ApertureLibraries\  ← Aperture writes here            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points

- **STRM mode required** — Symlinks don't work between a Linux container and Windows host
- **No media access needed** — Aperture reads everything from Emby's API
- **Only one output folder** — Aperture writes STRM files to a single location
- **Works with network shares** — Your media can be on NAS devices; Emby handles the paths

---

## Prerequisites

- Windows 10/11 (64-bit)
- Emby or Jellyfin installed and running on Windows
- Admin access to your media server (for API key)
- At least 4GB RAM available for Docker

---

## Step 1: Install Docker Desktop

### Download

1. Go to [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
2. Click **Download for Windows**
3. Run the installer (`Docker Desktop Installer.exe`)

### Installation

1. During installation, ensure **WSL 2** is selected (recommended)
2. Click **Install**
3. Restart Windows when prompted

### First Launch

1. Open **Docker Desktop** from the Start menu
2. Accept the service agreement
3. Skip or complete the optional sign-in/survey
4. Wait for Docker to start (whale icon in system tray turns solid)

### Verify Installation

Open **PowerShell** and run:

```powershell
docker --version
docker-compose --version
```

Both commands should return version numbers.

---

## Step 2: Prepare Folders

Create folders for Aperture's data. Open **PowerShell** and run:

```powershell
# Create folders (adjust paths as needed)
mkdir C:\ApertureLibraries
mkdir C:\ApertureBackups
```

### Using Network Shares

If you want Aperture's output on a NAS:

1. Ensure the network share is mapped or accessible
2. Create the folder on your NAS (e.g., `\\NAS\Media\ApertureLibraries`)
3. Note the Windows path (e.g., `M:\Media\ApertureLibraries` if mapped to M:)

---

## Step 3: Get Your Configuration Ready

### Find Your Windows IP Address

Open **PowerShell** and run:

```powershell
ipconfig
```

Look for your **IPv4 Address** (e.g., `192.168.1.100`).

### Generate a Session Secret

1. Go to [randomkeygen.com](https://randomkeygen.com/)
2. Copy a **Fort Knox Password** (or any 32+ character random string)

### Get Your Emby/Jellyfin API Key

**For Emby:**

1. Open Emby in your browser
2. Go to **Dashboard → Advanced → API Keys**
3. Click **New API Key**
4. Name it "Aperture" and copy the key

**For Jellyfin:**

1. Open Jellyfin in your browser
2. Go to **Dashboard → API Keys**
3. Click **Add**
4. Name it "Aperture" and copy the key

---

## Step 4: Create the Docker Compose File

### Option A: Download the Pre-made File

Download `docker-compose.windows.yml` from the Aperture repository and save it to a folder like `C:\Aperture\`.

### Option B: Create Manually

1. Create a folder: `C:\Aperture`
2. Create a file named `docker-compose.yml` in that folder
3. Copy this content:

```yaml
# =============================================================================
# Aperture - Windows Docker Desktop
# =============================================================================

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: aperture-db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: aperture
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d aperture']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  app:
    image: ghcr.io/dgruhin-hrizn/aperture:latest
    container_name: aperture
    user: root
    environment:
      NODE_ENV: production
      PORT: 3456
      DATABASE_URL: postgres://app:app@db:5432/aperture
      RUN_MIGRATIONS_ON_START: 'true'
      TZ: America/New_York
      # =========================================================================
      # REQUIRED: Set these values!
      # =========================================================================
      APP_BASE_URL: http://YOUR_WINDOWS_IP:3456
      SESSION_SECRET: PASTE_YOUR_RANDOM_KEY_HERE
    ports:
      - '3456:3456'
    depends_on:
      db:
        condition: service_healthy
    volumes:
      # Aperture Libraries Output
      - C:/ApertureLibraries:/aperture-libraries
      # Database Backups
      - C:/ApertureBackups:/backups
    restart: unless-stopped

volumes:
  pgdata:
```

### Edit the Configuration

Open the file in Notepad and update:

| Setting | What to Change |
|---------|---------------|
| `APP_BASE_URL` | Replace `YOUR_WINDOWS_IP` with your actual IP (e.g., `http://192.168.1.100:3456`) |
| `SESSION_SECRET` | Paste your random key from Step 3 |
| `TZ` | Your timezone in IANA format (e.g., `Europe/London`, `America/Los_Angeles`) |
| Volume paths | Adjust `C:/ApertureLibraries` and `C:/ApertureBackups` if using different locations |

### Volume Path Formats

Docker Desktop on Windows accepts paths in these formats:

| Location | Docker Compose Format |
|----------|----------------------|
| Local folder | `C:/ApertureLibraries:/aperture-libraries` |
| Network share (IP) | `//192.168.1.50/Media/ApertureLibraries:/aperture-libraries` |
| Network share (name) | `//NAS/Media/ApertureLibraries:/aperture-libraries` |

> **Note:** Use forward slashes (`/`) in paths, not backslashes.

---

## Step 5: Start Aperture

Open **PowerShell**, navigate to your Aperture folder, and start the containers:

```powershell
cd C:\Aperture
docker-compose up -d
```

Watch the progress:

```powershell
docker-compose logs -f
```

Press `Ctrl+C` to stop watching logs (containers keep running).

### Verify Containers Are Running

```powershell
docker ps
```

You should see `aperture` and `aperture-db` containers.

---

## Step 6: Complete the Setup Wizard

### Access Aperture

Open your browser and go to:

```
http://YOUR_WINDOWS_IP:3456
```

Or use `http://localhost:3456` from the same machine.

### Media Server Connection

| Setting | Value |
|---------|-------|
| Server Type | Emby or Jellyfin |
| Server URL | `http://host.docker.internal:8096` |
| API Key | Your API key from Step 3 |

> **Important:** Use `host.docker.internal` instead of `localhost`. This special hostname allows Docker containers to reach services running on the Windows host.

### File Locations

| Setting | Value |
|---------|-------|
| Aperture Libraries Path | The **Windows path** to your ApertureLibraries folder |

Examples:
- Local: `C:\ApertureLibraries\`
- Network: `M:\Media\ApertureLibraries\` (use drive letter, not UNC)

### Output Format — CRITICAL!

| Setting | Value |
|---------|-------|
| Movies Use Symlinks | **OFF** (use STRM) |
| Series Use Symlinks | **OFF** (use STRM) |

> ⚠️ **STRM mode is required!** Symlinks cannot work between a Linux container and Windows filesystem.

---

## Step 7: Add Libraries to Emby

After Aperture generates recommendations:

1. Open **Emby Dashboard**
2. Go to **Library → Add Media Library**
3. Select **Movies** or **TV Shows**
4. Add the folder: `C:\ApertureLibraries\[LibraryName]`
5. Repeat for each Aperture library

---

## How STRM Mode Works

### The Problem

Aperture runs inside a Linux container, but your media files are on Windows. Linux symlinks can't point to Windows paths.

### The Solution

STRM files are simple text files containing a path. When Emby sees a `.strm` file, it reads the path inside and plays that file.

Example STRM file content:

```
D:\Movies\Oppenheimer (2023)\Oppenheimer.mkv
```

### Why This Works with Multiple NAS Devices

It doesn't matter if your movies are on drive `O:` and TV shows are on drive `M:`. Emby already has all those paths in its database. Aperture:

1. Queries Emby's API to get media info + file paths
2. Writes STRM files to ONE location (e.g., `C:\ApertureLibraries\`)
3. Each STRM file contains the original Windows path
4. Emby reads the STRM, follows the path, plays the file

---

## Managing Aperture

### View Logs

```powershell
docker logs aperture
docker logs aperture-db
```

### Stop Aperture

```powershell
cd C:\Aperture
docker-compose down
```

### Start Aperture

```powershell
cd C:\Aperture
docker-compose up -d
```

### Update to Latest Version

```powershell
cd C:\Aperture
docker-compose pull
docker-compose up -d
```

### Complete Reset (Delete All Data)

```powershell
cd C:\Aperture
docker-compose down -v
docker-compose up -d
```

> **Warning:** This deletes the database. Back up first if needed.

---

## Troubleshooting

### "Cannot connect to Emby"

1. Verify Emby is running: Open `http://localhost:8096` in your browser
2. In Aperture, use `http://host.docker.internal:8096` (not `localhost`)
3. Check Windows Firewall isn't blocking port 8096
4. Ensure Docker Desktop is using WSL 2 backend

### "Permission denied" on network share

1. Open **Docker Desktop → Settings → Resources → File Sharing**
2. Add the network path
3. For authenticated shares, use IP address format: `//192.168.1.50/Share`
4. You may need to configure credentials in Windows Credential Manager

### Container won't start

1. Ensure Docker Desktop is running (whale icon in system tray)
2. Check Docker Desktop dashboard for errors
3. Run: `docker logs aperture` for error details
4. Verify all paths exist and are accessible

### STRM files not working

1. Open a STRM file with Notepad — verify it contains a valid Windows path
2. Test that path works: Copy the path, paste in File Explorer
3. Ensure Emby can access that path (same user account)
4. Re-scan the library in Emby

### "host.docker.internal" not resolving

This should work automatically on Windows. If not:

1. Ensure Docker Desktop is using WSL 2 (Settings → General → Use WSL 2)
2. Restart Docker Desktop
3. As a workaround, use your Windows IP address instead

---

## Example Configuration

Here's a complete example for a user with:

- Windows IP: `192.168.1.100`
- Emby running on Windows at port 8096
- Movies on NAS: `M:\MediaNAS\Movies\`
- TV Shows on NAS: `N:\MediaNAS2\TV\`
- Aperture output on NAS: `M:\MediaNAS\ApertureLibraries\`

### docker-compose.yml

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: aperture-db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: aperture
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d aperture']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  app:
    image: ghcr.io/dgruhin-hrizn/aperture:latest
    container_name: aperture
    user: root
    environment:
      NODE_ENV: production
      PORT: 3456
      DATABASE_URL: postgres://app:app@db:5432/aperture
      RUN_MIGRATIONS_ON_START: 'true'
      TZ: Europe/Amsterdam
      APP_BASE_URL: http://192.168.1.100:3456
      SESSION_SECRET: xK9#mP2$vL5nQ8wR3tY6uI0oA7sD4fG1hJ
    ports:
      - '3456:3456'
    depends_on:
      db:
        condition: service_healthy
    volumes:
      # Using network share via UNC path
      - //192.168.1.50/MediaNAS/ApertureLibraries:/aperture-libraries
      - //192.168.1.50/MediaNAS/ApertureBackups:/backups
    restart: unless-stopped

volumes:
  pgdata:
```

### Setup Wizard Settings

| Setting | Value |
|---------|-------|
| Media Server URL | `http://host.docker.internal:8096` |
| Aperture Libraries Path | `M:\MediaNAS\ApertureLibraries\` |
| Movies Use Symlinks | OFF |
| Series Use Symlinks | OFF |

---

## Next Steps

- [Post-Setup Checklist](post-setup-checklist.md) — Verify everything is working
- [Job Scheduling](job-scheduling.md) — Configure when jobs run
- [AI Providers](ai-providers.md) — Set up AI for recommendations
