import { Typography, Card, CardContent, TextField } from '@mui/material'

interface ProfileSectionProps {
  user: {
    username?: string
    displayName?: string | null
    provider?: string
    isAdmin?: boolean
  } | null
}

export function ProfileSection({ user }: ProfileSectionProps) {
  return (
    <Card sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={3}>
          Your Profile
        </Typography>

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

