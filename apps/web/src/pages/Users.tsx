import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Chip,
  IconButton,
  Skeleton,
  Alert,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'

interface User {
  id: string
  username: string
  display_name: string | null
  provider: 'emby' | 'jellyfin'
  is_admin: boolean
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export function UsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setError(null)
      } else {
        setError('Failed to load users')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleToggleEnabled = async (userId: string, currentValue: boolean) => {
    setUpdating(userId)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: !currentValue }),
      })

      if (response.ok) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, is_enabled: !currentValue } : user
          )
        )
      }
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          Users
        </Typography>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={4}>
          Users
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} mb={1}>
        Users
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage users and enable AI recommendations
      </Typography>

      <TableContainer
        component={Paper}
        sx={{ backgroundColor: 'background.paper', borderRadius: 2 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="center">AI Enabled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    No users found. Users will appear here after they log in.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {user.display_name || user.username}
                      </Typography>
                      {user.display_name && (
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.provider}
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    {user.is_admin ? (
                      <Chip label="Admin" size="small" color="primary" />
                    ) : (
                      <Chip label="User" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={user.is_enabled}
                      onChange={() => handleToggleEnabled(user.id, user.is_enabled)}
                      disabled={updating === user.id}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

