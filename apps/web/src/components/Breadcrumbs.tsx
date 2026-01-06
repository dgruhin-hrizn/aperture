import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  Box,
} from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import HomeIcon from '@mui/icons-material/Home'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  currentLabel?: string
}

// Route configuration for automatic breadcrumb generation
const routeLabels: Record<string, string> = {
  '': 'Home',
  'admin': 'Admin',
  'users': 'Users',
  'jobs': 'Jobs',
  'settings': 'Settings',
  'recommendations': 'Recommendations',
  'history': 'Watch History',
  'movies': 'Movies',
  'series': 'TV Series',
  'playlists': 'Playlists',
}

export function Breadcrumbs({ items, currentLabel }: BreadcrumbsProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()

  // Generate breadcrumbs from current path if items not provided
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    if (items) return items

    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    let currentPath = ''
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i]
      currentPath += `/${segment}`

      // Skip dynamic segments (e.g., user IDs)
      if (params.id && segment === params.id) {
        continue
      }

      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
      
      // Last segment is current page (no link)
      if (i === pathSegments.length - 1 && !currentLabel) {
        breadcrumbs.push({ label })
      } else {
        breadcrumbs.push({ label, path: currentPath })
      }
    }

    // Add current label if provided (e.g., user name)
    if (currentLabel) {
      breadcrumbs.push({ label: currentLabel })
    }

    return breadcrumbs
  }, [items, location.pathname, params.id, currentLabel])

  // Don't render if only one item or empty
  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-ol': {
            flexWrap: 'nowrap',
          },
        }}
      >
        {/* Home link */}
        <Link
          component="button"
          variant="body2"
          onClick={() => navigate('/')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline',
            },
          }}
        >
          <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />
        </Link>

        {/* Path segments */}
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1

          if (isLast || !item.path) {
            return (
              <Typography
                key={index}
                variant="body2"
                color="text.primary"
                fontWeight={500}
                sx={{ 
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>
            )
          }

          return (
            <Link
              key={index}
              component="button"
              variant="body2"
              onClick={() => item.path && navigate(item.path)}
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </MuiBreadcrumbs>
    </Box>
  )
}


