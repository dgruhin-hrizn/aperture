import sharp from 'sharp'

// Emby green color
const EMBY_GREEN = '#52B54B'
// Aperture purple accent
const APERTURE_PURPLE = '#8B5CF6'
// Top Picks black
const TOP_PICKS_BLACK = '#000000'

/**
 * Create a ranked poster with badge overlays:
 * - Top left: Semi-transparent black square with white rank number (flush to corner)
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

  // Rank badge sizing - same as Top Picks (larger)
  const rankBadgeRadius = Math.round(Math.min(width, height) * 0.18)
  const rankFontSize = Math.round(rankBadgeRadius * 1.1)
  const squareSize = rankBadgeRadius * 2
  
  // Match percentage badge sizing (smaller, top right)
  const matchBadgeRadius = Math.round(Math.min(width, height) * 0.08)
  const padding = Math.round(matchBadgeRadius * 0.5)
  const percentFontSize = Math.round(matchBadgeRadius * 0.7)
  const ringStroke = Math.round(matchBadgeRadius * 0.15)
  
  // Progress ring calculations
  const ringRadius = matchBadgeRadius - ringStroke / 2 - 2
  const ringCircumference = 2 * Math.PI * ringRadius
  const progressOffset = ringCircumference * (1 - matchPercent / 100)

  // Create SVG overlay with both badges
  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shadow filter for match badge -->
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
        
        <!-- Slight glow for rank number -->
        <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- TOP LEFT: Rank badge square touching top and left edges -->
      <g>
        <!-- Semi-transparent black square background -->
        <rect 
          x="0" 
          y="0" 
          width="${squareSize}" 
          height="${squareSize}" 
          fill="rgba(0,0,0,0.6)"
        />
        <!-- Rank number -->
        <text 
          x="${rankBadgeRadius}" 
          y="${rankBadgeRadius}" 
          dy="0.38em"
          font-family="Oswald, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${rankFontSize}" 
          font-weight="700" 
          fill="white" 
          text-anchor="middle"
        >${rank}</text>
      </g>
      
      <!-- TOP RIGHT: Match percentage badge (black with purple ring) -->
      <g transform="translate(${width - padding - matchBadgeRadius}, ${padding + matchBadgeRadius})" filter="url(#shadow)">
        <!-- Black circle background -->
        <circle 
          cx="0" 
          cy="0" 
          r="${matchBadgeRadius}" 
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

/**
 * Create a Top Picks poster with rank-only badge in upper-left
 * Semi-transparent black circle background, white Oswald Bold number
 * 
 * Design:
 * ┌────────────────────┐
 * │╭──╮                │
 * ││ 1│                │  ← 80% black circle (20% transparent)
 * │╰──╯                │    White number, Oswald/system-ui Bold
 * │                    │
 * │   [Movie Poster]   │
 * │                    │
 * └────────────────────┘
 */
export async function createTopPicksPoster(
  posterBuffer: Buffer,
  rank: number
): Promise<Buffer> {
  // Get original poster dimensions
  const metadata = await sharp(posterBuffer).metadata()
  const width = metadata.width || 1000
  const height = metadata.height || 1500

  // Badge sizing - proportional to image size (2x larger than before)
  const badgeRadius = Math.round(Math.min(width, height) * 0.18)
  const fontSize = Math.round(badgeRadius * 1.1)

  // Create SVG overlay with rank badge touching upper-left corner
  const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Shadow filter for badge -->
        <filter id="badgeShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.6)"/>
        </filter>
        
        <!-- Slight glow for the number -->
        <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- TOP LEFT: Rank badge square touching top and left edges -->
      <g>
        <!-- Semi-transparent black square background -->
        <rect 
          x="0" 
          y="0" 
          width="${badgeRadius * 2}" 
          height="${badgeRadius * 2}" 
          fill="rgba(0,0,0,0.6)"
        />
        <!-- Rank number -->
        <text 
          x="${badgeRadius}" 
          y="${badgeRadius}" 
          dy="0.38em"
          font-family="Oswald, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${fontSize}" 
          font-weight="700" 
          fill="white" 
          text-anchor="middle"
        >${rank}</text>
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

