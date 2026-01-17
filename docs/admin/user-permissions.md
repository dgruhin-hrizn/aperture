# User Permissions

Configure per-user settings and override permissions.

## Accessing Permissions

Navigate to **Admin → Users → [User]**

---

## Permission Types

### Global vs User Settings

| Level | Set By | Applies To |
|-------|--------|------------|
| **Global** | Admin | All users (default) |
| **User Override** | User | That user only |
| **Admin Lock** | Admin | Cannot be overridden |

---

## AI Explanations Permission

### Global Setting

Admin → Settings → AI Recommendations → AI Features:
- Enable/disable explanations for all users

### Allow Override

On user detail page:
- Toggle **Allow AI Explanation Override**
- When enabled, user can toggle in their settings

### User Setting

If override allowed:
- User goes to User Settings → Preferences
- Toggles AI Explanations on/off

### Priority

```
1. Admin locked (forced on/off)
2. User preference (if override allowed)
3. Global default
```

---

## Algorithm Override Permission

### Global Weights

Admin → Settings → AI Recommendations → Algorithm:
- Sets default weights for all users

### Allow Override

On user detail page:
- Toggle **Allow Algorithm Override**
- When enabled, user can adjust weights

### User Weights

If override allowed:
- User goes to User Settings → AI Algorithm
- Adjusts sliders for:
  - Similarity
  - Popularity
  - Recency
  - Rating
  - Diversity

### Normalization

User weights are automatically normalized:
- Frontend shows 0-100 sliders
- Backend normalizes to sum = 1.0

### Priority

```
1. User weights (if set and override allowed)
2. Global defaults
```

---

## Watch History Management

### Permission

On user detail page:
- Toggle **Enable Watch History Management**

### When Enabled

User can:
- Mark movies as unwatched
- Mark episodes/seasons as unwatched
- Remove items from watch history

### UI Elements

User sees:
- "Mark Unwatched" buttons on movies
- "Mark Unwatched" options on episodes
- Confirmation dialogs

### Sync Behavior

Changes propagate to:
- Aperture database
- Media server (bidirectional)

---

## Library Name Override

### Default

Libraries named from admin template:
- `AI Picks - {{username}} - Movies`

### User Override

Users can customize in User Settings → Preferences:
- Movie library name
- Series library name

### When Applied

On next library build job, user's custom names are used.

---

## Content Filtering

### Exclude Content Types

Users can optionally exclude:
- Specific genres
- Content ratings
- Minimum rating threshold

### Configuration

User Settings → Preferences → Content Filters

### Effect

Excluded content won't appear in recommendations even if highly matched.

---

## Rating Preferences

### Heart Rating Override

Default uses 10-heart scale for all users.

### Per-User Setting

If needed, users can:
- Hide ratings (for privacy)
- View-only mode (see ratings, can't modify)

---

## Permission Matrix

| Feature | Admin Only | User Override Possible |
|---------|------------|------------------------|
| Enable recommendations | ✓ | ✗ |
| Algorithm weights | Default | ✓ (if allowed) |
| AI explanations | Default | ✓ (if allowed) |
| Library names | Template | ✓ |
| Watch management | ✗ | ✓ (if allowed) |
| Content filters | ✗ | ✓ |

---

## Viewing User Preferences

### Admin View

On user detail page:
- Current preference values
- Override status
- Last modified dates

### Resetting User Preferences

To reset a user to defaults:
1. Go to user detail page
2. Click **Reset to Defaults** (if available)
3. User preferences cleared
4. Global defaults apply

---

## Bulk Permissions

### Enable Feature for All

To allow all users to override:
1. Admin → Settings → relevant section
2. Enable "Allow User Override" globally

### Disable for All

To lock settings:
1. Disable global override option
2. Individual user permissions ignored

---

## Security Considerations

### What Users Can't Change

- Their recommendation enabled status
- Admin privileges
- Other users' data
- System configuration

### Privacy

Users can only see:
- Their own settings
- Their own watch history
- Their own recommendations

Admins can view:
- All user settings
- All statistics
- System-wide data

---

## Troubleshooting

### User Can't Find Setting

1. Check if override is allowed
2. Verify feature is enabled globally
3. Check user settings path

### Override Not Taking Effect

1. Confirm override permission granted
2. Check user has set a value
3. Re-run recommendation job

### Permissions Reset

1. Check for system updates
2. Review admin changes
3. Re-apply permissions

---

**Previous:** [User Management](user-management.md) | **Next:** [API Errors](api-errors.md)
