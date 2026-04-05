import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  Paper,
  Popper,
  Typography,
  alpha,
  useTheme,
  ClickAwayListener,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import SortIcon from '@mui/icons-material/Sort'
import CheckIcon from '@mui/icons-material/Check'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import TitleIcon from '@mui/icons-material/Title'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import EventIcon from '@mui/icons-material/Event'
import StarIcon from '@mui/icons-material/Star'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import LayersIcon from '@mui/icons-material/Layers'

export type SortField = 'title' | 'year' | 'releaseDate' | 'rating' | 'rtScore' | 'metacritic' | 'runtime' | 'added' | 'seasons'
export type SortOrder = 'asc' | 'desc'

interface SortOption {
  field: SortField
  label: string
  icon: React.ReactNode
  defaultOrder: SortOrder
  availableFor: ('movies' | 'series')[]
}

type SortOptionDef = Omit<SortOption, 'label'> & { labelKey: string }

const SORT_OPTION_DEFS: SortOptionDef[] = [
  {
    field: 'title',
    labelKey: 'sortPopper.fields.title',
    icon: <TitleIcon fontSize="small" />,
    defaultOrder: 'asc',
    availableFor: ['movies', 'series'],
  },
  {
    field: 'year',
    labelKey: 'sortPopper.fields.year',
    icon: <CalendarTodayIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies', 'series'],
  },
  {
    field: 'releaseDate',
    labelKey: 'sortPopper.fields.releaseDate',
    icon: <EventIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies'],
  },
  {
    field: 'rating',
    labelKey: 'sortPopper.fields.rating',
    icon: <StarIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies', 'series'],
  },
  {
    field: 'rtScore',
    labelKey: 'sortPopper.fields.rtScore',
    icon: <ThumbUpIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies', 'series'],
  },
  {
    field: 'metacritic',
    labelKey: 'sortPopper.fields.metacritic',
    icon: <ThumbUpIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies', 'series'],
  },
  {
    field: 'runtime',
    labelKey: 'sortPopper.fields.runtime',
    icon: <AccessTimeIcon fontSize="small" />,
    defaultOrder: 'asc',
    availableFor: ['movies'],
  },
  {
    field: 'seasons',
    labelKey: 'sortPopper.fields.seasons',
    icon: <LayersIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['series'],
  },
  {
    field: 'added',
    labelKey: 'sortPopper.fields.added',
    icon: <NewReleasesIcon fontSize="small" />,
    defaultOrder: 'desc',
    availableFor: ['movies', 'series'],
  },
]

interface SortPopperProps {
  type: 'movies' | 'series'
  sortBy: SortField
  sortOrder: SortOrder
  onChange: (sortBy: SortField, sortOrder: SortOrder) => void
}

export function SortPopper({ type, sortBy, sortOrder, onChange }: SortPopperProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const open = Boolean(anchorEl)

  const sortOptions = useMemo(
    () =>
      SORT_OPTION_DEFS.map((d) => ({
        field: d.field,
        icon: d.icon,
        defaultOrder: d.defaultOrder,
        availableFor: d.availableFor,
        label: t(d.labelKey),
      })),
    [t]
  )

  const availableOptions = sortOptions.filter((opt) => opt.availableFor.includes(type))
  const currentOption = availableOptions.find((opt) => opt.field === sortBy) || availableOptions[0]

  const handleSelect = (option: SortOption) => {
    if (option.field === sortBy) {
      // Toggle order if same field
      onChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Use default order for new field
      onChange(option.field, option.defaultOrder)
    }
    setAnchorEl(null)
  }

  const getOrderLabel = () => {
    if (sortBy === 'title') {
      return sortOrder === 'asc' ? t('sortPopper.order.az') : t('sortPopper.order.za')
    }
    if (sortBy === 'year' || sortBy === 'added' || sortBy === 'releaseDate') {
      return sortOrder === 'desc' ? t('sortPopper.order.newest') : t('sortPopper.order.oldest')
    }
    if (sortBy === 'runtime') {
      return sortOrder === 'asc' ? t('sortPopper.order.shortest') : t('sortPopper.order.longest')
    }
    if (sortBy === 'seasons') {
      return sortOrder === 'desc' ? t('sortPopper.order.most') : t('sortPopper.order.fewest')
    }
    return sortOrder === 'desc' ? t('sortPopper.order.highest') : t('sortPopper.order.lowest')
  }

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<SortIcon />}
        endIcon={sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}
        size="small"
        sx={{
          height: 40,
          px: 1.75,
          borderColor: open ? 'primary.main' : alpha(theme.palette.text.primary, 0.23),
          color: open ? 'primary.main' : 'text.primary',
          backgroundColor: open ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          textTransform: 'none',
          fontWeight: 400,
          '&:hover': {
            borderColor: open ? 'primary.main' : 'text.primary',
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
          minWidth: 180,
          justifyContent: 'flex-start',
          '& .MuiButton-endIcon': {
            marginLeft: 'auto',
          },
        }}
      >
        {currentOption.label}: {getOrderLabel()}
      </Button>

      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ zIndex: 1300 }}
        modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      >
        <ClickAwayListener onClickAway={() => setAnchorEl(null)}>
          <Paper
            elevation={8}
            sx={{
              width: 220,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                {t('sortPopper.sortBy')}
              </Typography>
            </Box>

            <List dense disablePadding>
              {availableOptions.map((option) => {
                const isSelected = option.field === sortBy
                return (
                  <ListItemButton
                    key={option.field}
                    onClick={() => handleSelect(option)}
                    sx={{
                      py: 1,
                      backgroundColor: isSelected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: isSelected
                          ? alpha(theme.palette.primary.main, 0.12)
                          : alpha(theme.palette.action.hover, 0.08),
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 36,
                        color: isSelected ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      {option.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={option.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'primary.main' : 'text.primary',
                      }}
                    />
                    {isSelected && (
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {sortOrder === 'asc' ? (
                          <ArrowUpwardIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        ) : (
                          <ArrowDownwardIcon fontSize="small" sx={{ color: 'primary.main' }} />
                        )}
                        <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />
                      </Box>
                    )}
                  </ListItemButton>
                )
              })}
            </List>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  )
}
