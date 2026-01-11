import { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Collapse,
  Paper,
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import StorageIcon from '@mui/icons-material/Storage'
import TvIcon from '@mui/icons-material/Tv'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { SetupWizardContext } from '../types'

interface OutputConfigStepProps {
  wizard: SetupWizardContext
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Box sx={{ mt: 1 }}>
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ textTransform: 'none', color: 'primary.main', pl: 0 }}
      >
        {title}
      </Button>
      <Collapse in={expanded}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mt: 1,
            backgroundColor: 'action.hover',
            borderColor: 'primary.main',
            borderLeftWidth: 3,
          }}
        >
          {children}
        </Paper>
      </Collapse>
    </Box>
  )
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      sx={{
        p: 2,
        mt: 2,
        backgroundColor: 'primary.dark',
        border: '1px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <TipsAndUpdatesIcon sx={{ color: 'primary.light', mt: 0.25 }} fontSize="small" />
        <Box>{children}</Box>
      </Box>
    </Paper>
  )
}

export function OutputConfigStep({ wizard }: OutputConfigStepProps) {
  const {
    error,
    outputPathConfig,
    setOutputPathConfig,
    saveOutputPathConfig,
    saving,
    goToStep,
  } = wizard

  const handleSymlinksChange = (type: 'movies' | 'series', enabled: boolean) => {
    if (type === 'movies') {
      setOutputPathConfig((c) => ({ ...c, moviesUseSymlinks: enabled }))
    } else {
      setOutputPathConfig((c) => ({ ...c, seriesUseSymlinks: enabled }))
    }
  }

  // Auto-compute libraries path from prefix when user types prefix
  const handlePrefixChange = (value: string) => {
    const prefix = value.endsWith('/') ? value : value + '/'
    setOutputPathConfig((c) => ({
      ...c,
      mediaServerPathPrefix: prefix,
      // Auto-suggest libraries path if user hasn't customized it
      mediaServerLibrariesPath:
        c.mediaServerLibrariesPath === '/mnt/ApertureLibraries/' ||
        c.mediaServerLibrariesPath === c.mediaServerPathPrefix + 'ApertureLibraries/'
          ? prefix + 'ApertureLibraries/'
          : c.mediaServerLibrariesPath,
    }))
  }

  const useSymlinks = outputPathConfig.moviesUseSymlinks || outputPathConfig.seriesUseSymlinks

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Library Output
      </Typography>

      {/* Intro */}
      <Alert severity="info" sx={{ mb: 3 }} icon={<TipsAndUpdatesIcon />}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Aperture creates virtual libraries containing your personalized recommendations. For your media server
          to see these libraries, you need to tell Aperture where your media server looks for files.
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          Pro Tip: The easiest setup is to create Aperture's folder <em>inside</em> your existing media
          share — that way your media server can already see it without any extra configuration!
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Question 1: Media Server Path Prefix */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <StorageIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Media Server Path Prefix
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is the base path that appears when you look at file locations in Emby or Jellyfin.
          </Typography>

          <TextField
            fullWidth
            label="What path does your media server use for media files?"
            placeholder="/mnt/"
            value={outputPathConfig.mediaServerPathPrefix}
            onChange={(e) => handlePrefixChange(e.target.value)}
            margin="normal"
            InputProps={{
              startAdornment: <TvIcon sx={{ color: 'text.secondary', mr: 1 }} />,
            }}
          />

          <HelpSection title="How do I find this?">
            <Typography variant="body2" sx={{ mb: 2 }}>
              1. Open your media server (Emby/Jellyfin)
              <br />
              2. Go to any movie and click the <strong>⋮</strong> menu → <strong>Media Info</strong>
              <br />
              3. Look at the <strong>Path</strong> field
              <br />
              4. The path prefix is everything before your media folders
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Example:</strong> If Emby shows a path like:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', pl: 2, color: 'primary.light' }}
            >
              /mnt/Movies/Inception (2010)/Inception.mkv
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Your path prefix is: <strong>/mnt/</strong>
            </Typography>
          </HelpSection>

          <ExampleBox>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Unraid Example:
            </Typography>
            <Typography variant="body2" component="div">
              • Your media lives at: <code>/mnt/user/Media/</code> on your server
              <br />
              • You mounted this in Emby's Docker at: <code>/mnt</code>
              <br />
              • So Emby sees movies at: <code>/mnt/Movies/...</code>
              <br />• <strong>Enter:</strong> <code>/mnt/</code>
            </Typography>
          </ExampleBox>
        </CardContent>
      </Card>

      {/* Question 2: Aperture Libraries Location */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <FolderOpenIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Aperture Libraries Location
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is the path <em>inside your media server</em> where it will find the recommendation
            libraries that Aperture creates.
          </Typography>

          <TextField
            fullWidth
            label="Where will your media server see Aperture's libraries?"
            placeholder="/mnt/ApertureLibraries/"
            value={outputPathConfig.mediaServerLibrariesPath}
            onChange={(e) =>
              setOutputPathConfig((c) => ({ ...c, mediaServerLibrariesPath: e.target.value }))
            }
            margin="normal"
            InputProps={{
              startAdornment: <FolderOpenIcon sx={{ color: 'text.secondary', mr: 1 }} />,
            }}
          />

          <HelpSection title="Recommended setup">
            <Typography variant="body2" sx={{ mb: 2 }}>
              <strong>The easiest approach:</strong> Create Aperture's folder inside your existing media
              share. Since your media server already has access to that share, it will automatically see
              Aperture's libraries too!
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Step by step:
            </Typography>
            <Typography variant="body2" component="div">
              1. Create a new folder on your host inside your media share
              <br />
              &nbsp;&nbsp;&nbsp;(e.g., <code>/mnt/user/Media/ApertureLibraries</code>)
              <br />
              2. Mount this folder in Aperture's container at <code>/aperture-libraries</code>
              <br />
              3. Your media server already sees it!
              <br />
              &nbsp;&nbsp;&nbsp;(at <code>/mnt/ApertureLibraries</code> using the example above)
            </Typography>
          </HelpSection>

          <ExampleBox>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Unraid Example:
            </Typography>
            <Typography variant="body2" component="div">
              • You created: <code>/mnt/user/Media/ApertureLibraries</code> on your host
              <br />
              • Your Emby has <code>/mnt/user/Media</code> mounted at <code>/mnt</code>
              <br />
              • So Emby automatically sees this folder at: <code>/mnt/ApertureLibraries</code>
              <br />• <strong>Enter:</strong> <code>/mnt/ApertureLibraries/</code>
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}
            >
              Notice: We just took the media server path prefix (<code>/mnt/</code>) and added the
              folder name!
            </Typography>
          </ExampleBox>
        </CardContent>
      </Card>

      {/* Question 3: Output Format */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <LinkIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Output Format
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How should Aperture link to your media files?
          </Typography>

          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={outputPathConfig.moviesUseSymlinks}
                    onChange={(e) => handleSymlinksChange('movies', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Movies: {outputPathConfig.moviesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={outputPathConfig.seriesUseSymlinks}
                    onChange={(e) => handleSymlinksChange('series', e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      TV Series: {outputPathConfig.seriesUseSymlinks ? 'Symlinks' : 'STRM Files'}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2">
              <strong>Symlinks (Recommended)</strong> — Creates direct filesystem links to your original
              media files. Provides the best playback quality with no transcoding overhead.
            </Typography>
            <Typography variant="body2">
              <strong>STRM Files</strong> — Creates small text files containing streaming URLs. Use
              this if symlinks don't work in your environment (e.g., some Windows setups, network
              shares across different systems).
            </Typography>
          </Box>

          {useSymlinks && (
            <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningAmberIcon />}>
              <Typography variant="body2">
                <strong>Note for Windows users:</strong> Symlinks may require administrator privileges
                or specific Docker configuration. If your media server can't play symlinked files,
                switch to STRM files.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Visual Summary */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'background.default',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'inherit' }}>
          Your Setup Summary:
        </Typography>
        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
          {`Media Server Path:     ${outputPathConfig.mediaServerPathPrefix}
Libraries Path:        ${outputPathConfig.mediaServerLibrariesPath}
Output Format:         ${useSymlinks ? 'Symlinks' : 'STRM Files'}

How it works:
├── Aperture writes to:     /aperture-libraries/
│   └── Your media server sees: ${outputPathConfig.mediaServerLibrariesPath}
│
└── Symlinks point to:      ${outputPathConfig.mediaServerPathPrefix}Movies/...
    └── Aperture reads from: /media/Movies/...`}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant="outlined" onClick={() => goToStep('aiRecsLibraries')}>
          Back
        </Button>
        <Button variant="contained" onClick={saveOutputPathConfig} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  )
}
