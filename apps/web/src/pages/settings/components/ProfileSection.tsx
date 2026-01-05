import { Typography, Card, CardContent, TextField, Box, Avatar } from '@mui/material'

interface ProfileSectionProps {
  user: {
    username?: string
    displayName?: string | null
    provider?: string
    isAdmin?: boolean
    avatarUrl?: string | null
  } | null
}

export function ProfileSection({ user }: ProfileSectionProps) {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={3}>
          Your Profile
        </Typography>

        {/* Avatar and name header */}
        <Box display="flex" alignItems="center" gap={3} mb={4}>
          <Avatar
            src={user?.avatarUrl || undefined}
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.main',
              fontSize: '2rem',
            }}
          >
            {user?.username?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {user?.displayName || user?.username || 'User'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.isAdmin ? 'Administrator' : 'User'} • {user?.provider?.charAt(0).toUpperCase()}{user?.provider?.slice(1)}
            </Typography>
          </Box>
        </Box>

        <TextField
          label="Username"
          value={user?.username || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label="Display Name"
          value={user?.displayName || user?.username || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label="Provider"
          value={user?.provider || ''}
          fullWidth
          margin="normal"
          disabled
        />

        <TextField
          label="Role"
          value={user?.isAdmin ? 'Administrator' : 'User'}
          fullWidth
          margin="normal"
          disabled
        />
      </CardContent>
    </Card>
  )
}
