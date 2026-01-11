import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
  Paper,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FolderIcon from '@mui/icons-material/Folder'
import StorageIcon from '@mui/icons-material/Storage'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

function CodeBlock({ children }: { children: string }) {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'grey.900',
        borderRadius: 1,
        overflow: 'auto',
        '& pre': {
          m: 0,
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          color: 'grey.100',
        },
      }}
    >
      <pre>{children}</pre>
    </Paper>
  )
}

export function StrmSection() {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Aperture creates personalized recommendation libraries for each user as STRM files or symlinks. 
        Your media server reads these to display AI-curated collections.
      </Typography>

      <Stack spacing={2}>
          {/* What are STRM Files */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <HelpOutlineIcon color="primary" fontSize="small" />
                <Typography fontWeight={500}>What are STRM files?</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" paragraph>
                STRM files are simple text files that contain a URL to media content. When your media 
                server (Emby/Jellyfin) scans a library containing STRM files, it reads the URL inside 
                each file and uses it to stream the actual media.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Aperture uses STRM files to create <strong>virtual libraries</strong> of your 
                AI-recommended movies. The STRM files point back to your existing media files, 
                so no additional storage is required.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Each user gets their own personalized library (e.g., "AI Picks - John") containing 
                STRM files for their recommended movies.
              </Typography>
            </AccordionDetails>
          </Accordion>

          {/* Docker Setup */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <StorageIcon color="primary" fontSize="small" />
                <Typography fontWeight={500}>Docker Compose Setup</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" paragraph>
                For STRM files to work, both Aperture and your media server need access to the 
                same directory. Here's how to set up the volume mounts:
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                1. Create a shared STRM directory
              </Typography>
              <CodeBlock>{`# On your host machine
mkdir -p /path/to/strm/aperture`}</CodeBlock>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                2. Mount the directory in both containers
              </Typography>
              <CodeBlock>{`# docker-compose.yml

services:
  aperture:
    image: aperture
    volumes:
      # STRM output directory - Aperture writes here
      - /path/to/strm:/strm

  emby:  # or jellyfin
    image: emby/embyserver
    volumes:
      # Your existing media library
      - /path/to/media:/mnt/media:ro
      # STRM directory - must be the same as Aperture's
      - /path/to/strm:/strm:ro`}</CodeBlock>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                <strong>Important:</strong> The STRM path must be identical inside both containers. 
                If Aperture writes to <code>/strm/aperture/user/movie.strm</code>, your media 
                server must see the file at the same path.
              </Typography>
            </AccordionDetails>
          </Accordion>

          {/* Unraid Setup */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FolderIcon color="primary" fontSize="small" />
                <Typography fontWeight={500}>Unraid Setup</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" paragraph>
                On Unraid, you'll typically use a share for your STRM files. Here's the recommended setup:
              </Typography>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                1. Create a share for STRM files
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                In the Unraid web UI, create a new share called <code>strm</code> (or use an existing data share).
                This will be accessible at <code>/mnt/user/strm</code>.
              </Typography>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                2. Configure Aperture container path
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                In the Aperture Docker template:
              </Typography>
              <CodeBlock>{`Container Path: /strm
Host Path: /mnt/user/strm`}</CodeBlock>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                3. Configure Emby/Jellyfin container path
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                In your media server Docker template, add the same path mapping:
              </Typography>
              <CodeBlock>{`Container Path: /strm
Host Path: /mnt/user/strm
Access Mode: Read Only`}</CodeBlock>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                4. Add the library in your media server
              </Typography>
              <Typography variant="body2" color="text.secondary">
                After running the "Sync STRM" job in Aperture, add a new Movies library in 
                Emby/Jellyfin pointing to <code>/strm/aperture/[username]</code>. Aperture will 
                automatically create the folder structure for each user.
              </Typography>
            </AccordionDetails>
          </Accordion>

          {/* Troubleshooting */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <HelpOutlineIcon color="warning" fontSize="small" />
                <Typography fontWeight={500}>Troubleshooting</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Library not showing in media server
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Verify the STRM path is the same in both containers<br />
                    • Check that the "Sync STRM" job has run successfully<br />
                    • Ensure the media server has read permissions on the STRM directory<br />
                    • Rescan the library in your media server
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Movies not playing from STRM library
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • STRM files contain URLs to your original media files<br />
                    • Verify your media files are accessible to the media server<br />
                    • Check that the URLs in STRM files match your media server's internal paths<br />
                    • Try playing a movie directly from your main library to confirm streaming works
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Permission denied errors
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Aperture needs write access to the STRM directory<br />
                    • On Linux/Unraid, ensure the container user (usually UID 1000) has write permissions<br />
                    • You may need to <code>chown -R 1000:1000 /path/to/strm</code>
                  </Typography>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Current Configuration */}
          <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Path configuration is set in the Setup Wizard. Docker volume mounts: <code>/aperture-libraries</code> (output) 
              and <code>/media</code> (read-only media access).
            </Typography>
          </Box>
        </Stack>
    </Box>
  )
}
