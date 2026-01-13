import React, { useEffect, useRef } from 'react'
import { Box, Paper, Typography, Divider, Stack, Theme, SxProps } from '@mui/material'
import { useLocation } from 'react-router-dom'

interface DomainSectionProps {
  /** Section ID for hash anchor navigation */
  id?: string
  /** Section title */
  title: string
  /** Optional description text */
  description?: string
  /** Optional icon to display before title */
  icon?: React.ReactNode
  /** Main content */
  children: React.ReactNode
  /** Optional job panels to display at the bottom */
  jobPanels?: React.ReactNode
  /** Whether to show a divider before job panels */
  showJobDivider?: boolean
  /** Whether this is a sub-section (uses lighter styling) */
  isSubSection?: boolean
  /** Custom header action (e.g., button) */
  headerAction?: React.ReactNode
}

/**
 * DomainSection - A consistent wrapper for admin domain page sections
 * 
 * Features:
 * - Hash anchor navigation support (scrolls into view when URL hash matches id)
 * - Consistent Paper styling
 * - Title with optional icon and description
 * - Optional job panels area with divider
 */
export function DomainSection({
  id,
  title,
  description,
  icon,
  children,
  jobPanels,
  showJobDivider = true,
  isSubSection = false,
  headerAction,
}: DomainSectionProps) {
  const location = useLocation()
  const sectionRef = useRef<HTMLDivElement>(null)

  // Handle hash anchor navigation
  useEffect(() => {
    if (id && location.hash === `#${id}`) {
      // Delay to ensure DOM is ready
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Add a brief highlight effect
        sectionRef.current?.classList.add('highlight-section')
        setTimeout(() => {
          sectionRef.current?.classList.remove('highlight-section')
        }, 2000)
      }, 100)
    }
  }, [id, location.hash])

  const commonSx: SxProps<Theme> = {
    scrollMarginTop: 80, // Account for fixed header when scrolling
    transition: 'box-shadow 0.3s ease',
    '&.highlight-section': {
      boxShadow: (theme: Theme) => `0 0 0 2px ${theme.palette.primary.main}`,
    },
  }

  const innerContent = (
    <>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
        mb={description ? 1 : 2}
      >
        <Box display="flex" alignItems="center" gap={1}>
          {icon && (
            <Box sx={{ color: 'primary.main', display: 'flex' }}>
              {icon}
            </Box>
          )}
          <Typography
            variant={isSubSection ? 'subtitle1' : 'h6'}
            fontWeight={600}
          >
            {title}
          </Typography>
        </Box>
        {headerAction}
      </Stack>

      {description && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
      )}

      {/* Main Content */}
      <Box>{children}</Box>

      {/* Job Panels */}
      {jobPanels && (
        <>
          {showJobDivider && <Divider sx={{ my: 3 }} />}
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ mb: 2, display: 'block', letterSpacing: 1 }}
            >
              Related Jobs
            </Typography>
            {jobPanels}
          </Box>
        </>
      )}
    </>
  )

  if (isSubSection) {
    return (
      <Box ref={sectionRef} id={id} sx={{ mb: 3, ...commonSx }}>
        {innerContent}
      </Box>
    )
  }

  return (
    <Paper
      ref={sectionRef}
      id={id}
      sx={{
        p: 3,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        mb: 3,
        ...commonSx,
      }}
    >
      {innerContent}
    </Paper>
  )
}

/**
 * DomainSectionGroup - Groups multiple DomainSections with optional spacing
 */
interface DomainSectionGroupProps {
  children: React.ReactNode
  /** Optional title for the group */
  title?: string
  /** Optional description for the group */
  description?: string
}

export function DomainSectionGroup({ children, title, description }: DomainSectionGroupProps) {
  return (
    <Box sx={{ mb: 4 }}>
      {title && (
        <Typography
          variant="overline"
          sx={{
            color: 'primary.main',
            fontWeight: 700,
            letterSpacing: 1.5,
            mb: 1,
            display: 'block',
          }}
        >
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" color="text.secondary" mb={2}>
          {description}
        </Typography>
      )}
      {children}
    </Box>
  )
}
