import sharp from 'sharp'

// Emby green color
const EMBY_GREEN = '#52B54B'
// Aperture purple accent
const APERTURE_PURPLE = '#8B5CF6'

/**
 * Create a ranked poster with badge overlays:
 * - Top left: Emby green circle with white rank number
 * - Top right: Black circle with purple progress ring and white percentage
 * - Original poster dimensions preserved
 */
export async function createRankedPoster(
  posterBuffer: Buffer,
  rank: number,
  matchPercent: number
): Promise<Buffer> {
  // Get original poster dimensions
  const metadata = await sharp(posterBuffer).metadata()
  const width = metadata.width || 1000
  const height = metadata.height || 1500

  // Badge sizing - proportional to image size
  const badgeRadius = Math.round(Math.min(width, height) * 0.08)
  const padding = Math.round(badgeRadius * 0.5)
  const fontSize = Math.round(badgeRadius * 0.9)
  const percentFontSize = Math.round(badgeRadius * 0.7)
  const ringStroke = Math.round(badgeRadius * 0.15)
  
  // Progress ring calculations
  const ringRadius = badgeRadius - ringStroke / 2 - 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const progressOffset = ringCircumference * (1 - matchPercent / 100)

  // Create SVG overlay with both badges
  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shadow filter for badges -->
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.5)"/>
        </filter>
        
        <!-- Glow for purple ring -->
        <filter id="purpleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- TOP LEFT: Rank badge (Emby green with white number) -->
      <g transform="translate(${padding + badgeRadius}, ${padding + badgeRadius})" filter="url(#shadow)">
        <!-- Green circle background -->
        <circle 
          cx="0" 
          cy="0" 
          r="${badgeRadius}" 
          fill="${EMBY_GREEN}"
        />
        <!-- Rank number -->
        <text 
          x="0" 
          y="${fontSize * 0.35}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${fontSize}" 
          font-weight="800" 
          fill="white" 
          text-anchor="middle"
        >${rank}</text>
      </g>
      
      <!-- TOP RIGHT: Match percentage badge (black with purple ring) -->
      <g transform="translate(${width - padding - badgeRadius}, ${padding + badgeRadius})" filter="url(#shadow)">
        <!-- Black circle background -->
        <circle 
          cx="0" 
          cy="0" 
          r="${badgeRadius}" 
          fill="rgba(0,0,0,0.85)"
        />
        
        <!-- Background ring (subtle) -->
        <circle 
          cx="0" 
          cy="0" 
          r="${ringRadius}" 
          fill="none" 
          stroke="rgba(255,255,255,0.15)" 
          stroke-width="${ringStroke}"
        />
        
        <!-- Progress ring (purple) -->
        <circle 
          cx="0" 
          cy="0" 
          r="${ringRadius}" 
          fill="none" 
          stroke="${APERTURE_PURPLE}" 
          stroke-width="${ringStroke}"
          stroke-linecap="round"
          stroke-dasharray="${ringCircumference}"
          stroke-dashoffset="${progressOffset}"
          transform="rotate(-90)"
          filter="url(#purpleGlow)"
        />
        
        <!-- Percentage text -->
        <text 
          x="0" 
          y="${percentFontSize * 0.35}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${percentFontSize}" 
          font-weight="700" 
          fill="white" 
          text-anchor="middle"
        >${matchPercent}%</text>
      </g>
    </svg>
  `

  // Composite the overlay onto the original poster
  const result = await sharp(posterBuffer)
    .composite([
      {
        input: Buffer.from(overlaySvg),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer()

  return result
}

