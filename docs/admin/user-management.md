# User Management

Manage users and control who receives AI recommendations.

## Accessing Users

Navigate to **Admin → Users**

---

## User List

### Display

Shows all users from your media server:
- Avatar/profile picture
- Username
- Admin status
- Recommendation status (enabled/disabled)
- Last activity

### Sync Users

Click **Sync Users** to:
- Import new users from media server
- Update existing user information
- Sync email addresses (Emby Connect)

User sync also runs automatically every 30 minutes.

---

## User Cards

### Information Shown

| Field | Description |
|-------|-------------|
| **Username** | Display name from media server |
| **Avatar** | Profile picture |
| **Admin** | Admin badge if applicable |
| **Movies** | Toggle for movie recommendations |
| **Series** | Toggle for series recommendations |
| **Last Active** | Most recent activity |

### Quick Toggles

From the user list, quickly toggle:
- Movie recommendations ON/OFF
- Series recommendations ON/OFF

Changes take effect on next recommendation generation.

---

## User Detail Page

Click a user to view detailed settings.

### User Info

| Field | Description |
|-------|-------------|
| **Username** | Display name |
| **Email** | Email address (if available) |
| **Media Server ID** | Internal ID |
| **Created** | When user was added |
| **Last Sync** | When data was last synced |

### Recommendation Settings

| Setting | Description |
|---------|-------------|
| **Enable Movies** | Generate movie recommendations |
| **Enable Series** | Generate series recommendations |

### Watch Statistics

| Stat | Description |
|------|-------------|
| **Movies Watched** | Total movies watched |
| **Episodes Watched** | Total episodes watched |
| **Ratings Given** | Number of ratings |
| **Watch Time** | Total viewing time |

---

## Enabling Recommendations

For a user to receive recommendations:

### Requirements

1. User must exist in Aperture (synced from media server)
2. User must have watch history
3. Recommendations must be enabled (Movies and/or Series)
4. Recommendation jobs must run

### Enabling

1. Navigate to Admin → Users
2. Find the user
3. Toggle **Movies** and/or **Series** ON
4. Run recommendation jobs

---

## Bulk Actions

### Enable All Users

To quickly enable all users:
1. Each user has individual toggles
2. Enable movies/series for each

### Disable All

To disable recommendations entirely:
1. Toggle off for each user
2. Or disable at system level

---

## User Permissions

### Admin Override Settings

On user detail page, configure:

| Setting | Effect |
|---------|--------|
| **Allow AI Explanation Override** | User can toggle their own explanations |
| **Allow Algorithm Override** | User can adjust their own weights |

See [User Permissions](user-permissions.md) for details.

---

## Watch History Management

### Enable Mark Unwatched

Per-user setting to allow removing watch history:

1. Go to user detail page
2. Find "Watch History Management"
3. Toggle **Enable**

When enabled, user can:
- Mark movies as unwatched
- Mark episodes as unwatched
- Remove items from their history

### Why Enable?

- User accidentally marked something watched
- Want to rewatch and reset progress
- Clean up test data

### Sync Behavior

Changes sync to:
- Aperture database
- Media server (if supported)

---

## User Types

### Regular Users

- Receive recommendations (if enabled)
- Can customize their settings
- See their own libraries

### Admin Users

- Access Admin panel
- Configure system settings
- Manage other users
- View all data

### Disabled Users

If user is disabled in media server:
- Won't receive recommendations
- Data preserved
- Can re-enable by activating in media server

---

## Troubleshooting

### User Not Appearing

1. Click **Sync Users**
2. Check user exists in media server
3. Verify media server connection

### No Recommendations

1. Verify user is enabled
2. Check watch history exists
3. Confirm jobs have run
4. Review job logs

### Missing Watch History

1. Run watch history sync job
2. Check user has actually watched content
3. Verify library access in media server

---

**Previous:** [Global Jobs](global-jobs.md) | **Next:** [User Permissions](user-permissions.md)
