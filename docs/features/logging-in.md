# Logging In

Aperture uses your existing Emby or Jellyfin credentials — no separate account needed.

![Login Screen](../images/features/login.png)

## How to Log In

1. Open Aperture in your browser
2. Enter your **media server username**
3. Enter your **media server password**
4. Click **Sign In**

Aperture authenticates directly against your Emby or Jellyfin server.

## Passwordless Login

If your admin has enabled passwordless login (for servers that don't require passwords):

- The password field shows **(optional)**
- You can log in with just your username
- Helper text explains the configuration

## First-Time Login

The first time you log in, Aperture may need to:

1. Import your user account from the media server
2. Sync your watch history
3. Generate initial recommendations

This happens automatically — just wait a moment for everything to initialize.

## Troubleshooting

### "Invalid credentials"
- Verify your username and password work in Emby/Jellyfin directly
- Check if your account is enabled in the media server

### "User not found"
- Your admin may need to run a user sync
- Try logging into your media server first, then Aperture

### Can't see recommendations
- Your admin needs to enable AI recommendations for your account
- Watch history sync may still be in progress

## Session Duration

Your login session persists until you:
- Click **Logout** from the user menu
- Clear your browser cookies
- Your admin resets sessions

---

**Next:** [Dashboard Overview](dashboard.md)
