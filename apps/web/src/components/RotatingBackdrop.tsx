/**
 * RotatingBackdrop Component
 * 
 * Displays rotating fanart backdrop images with smooth crossfade transitions.
 * Uses a double-buffer approach for seamless transitions.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Box } from '@mui/material'
import { getProxiedImageUrl } from '@aperture/ui'

interface RotatingBackdropProps {
  /** Array of backdrop URLs to cycle through */
  backdropUrls: (string | null | undefined)[]
  /** Interval between transitions in milliseconds (default: 8000) */
  interval?: number
  /** Height of the backdrop container */
  height?: number | string
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function RotatingBackdrop({
  backdropUrls,
  interval = 8000,
  height = 280,
}: RotatingBackdropProps) {
  // Filter out null/undefined URLs and limit
  const validUrls = backdropUrls
    .filter((url): url is string => !!url)
    .slice(0, 20)

  // Shuffle on mount for variety
  const [shuffledUrls] = useState(() => shuffleArray(validUrls))
  
  // Double buffer: two image slots that alternate
  // activeSlot: 0 or 1, indicates which slot is currently visible
  const [activeSlot, setActiveSlot] = useState(0)
  const [slot0Url, setSlot0Url] = useState<string | null>(shuffledUrls[0] || null)
  const [slot1Url, setSlot1Url] = useState<string | null>(shuffledUrls[1] || null)
  const [slot0Loaded, setSlot0Loaded] = useState(false)
  const [slot1Loaded, setSlot1Loaded] = useState(false)
  
  const currentIndexRef = useRef(0)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  // Get proxied URL
  const getUrl = useCallback((url: string | null) => {
    if (!url) return null
    return getProxiedImageUrl(url, '')
  }, [])

  // Find next valid index (skip failed images)
  const findNextValidIndex = useCallback((fromIndex: number): number => {
    if (shuffledUrls.length === 0) return 0
    
    let nextIdx = (fromIndex + 1) % shuffledUrls.length
    let attempts = 0
    
    while (attempts < shuffledUrls.length) {
      const url = shuffledUrls[nextIdx]
      if (url && !failedImages.has(url)) {
        return nextIdx
      }
      nextIdx = (nextIdx + 1) % shuffledUrls.length
      attempts++
    }
    
    return fromIndex
  }, [shuffledUrls, failedImages])

  // Rotation effect
  useEffect(() => {
    if (shuffledUrls.length <= 1) return

    const timer = setInterval(() => {
      // Get next image index
      const nextIndex = findNextValidIndex(currentIndexRef.current)
      currentIndexRef.current = nextIndex
      const nextUrl = shuffledUrls[nextIndex]

      // Load next image into the hidden slot, then swap
      if (activeSlot === 0) {
        // Slot 0 is visible, load into slot 1
        setSlot1Url(nextUrl)
        setSlot1Loaded(false)
      } else {
        // Slot 1 is visible, load into slot 0
        setSlot0Url(nextUrl)
        setSlot0Loaded(false)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [shuffledUrls, interval, activeSlot, findNextValidIndex])

  // When the hidden slot finishes loading, perform the swap
  useEffect(() => {
    if (activeSlot === 0 && slot1Loaded && slot1Url) {
      // Slot 1 just loaded, swap to it and reset slot 0's loaded state
      setActiveSlot(1)
      setSlot0Loaded(false) // Prevent immediate swap back
    } else if (activeSlot === 1 && slot0Loaded && slot0Url) {
      // Slot 0 just loaded, swap to it and reset slot 1's loaded state
      setActiveSlot(0)
      setSlot1Loaded(false) // Prevent immediate swap back
    }
  }, [activeSlot, slot0Loaded, slot1Loaded, slot0Url, slot1Url])

  // Handle image load/error
  const handleSlot0Load = useCallback(() => setSlot0Loaded(true), [])
  const handleSlot1Load = useCallback(() => setSlot1Loaded(true), [])
  
  const handleSlot0Error = useCallback(() => {
    if (slot0Url) setFailedImages(prev => new Set(prev).add(slot0Url))
  }, [slot0Url])
  
  const handleSlot1Error = useCallback(() => {
    if (slot1Url) setFailedImages(prev => new Set(prev).add(slot1Url))
  }, [slot1Url])

  // Don't render if no valid URLs
  if (shuffledUrls.length === 0) {
    return null
  }

  const slot0ProxiedUrl = getUrl(slot0Url)
  const slot1ProxiedUrl = getUrl(slot1Url)

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* Slot 0 */}
      {slot0ProxiedUrl && !failedImages.has(slot0Url!) && (
        <Box
          component="img"
          src={slot0ProxiedUrl}
          alt=""
          onLoad={handleSlot0Load}
          onError={handleSlot0Error}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            opacity: activeSlot === 0 ? 1 : 0,
            transition: 'opacity 1.5s ease-in-out',
          }}
        />
      )}

      {/* Slot 1 */}
      {slot1ProxiedUrl && !failedImages.has(slot1Url!) && (
        <Box
          component="img"
          src={slot1ProxiedUrl}
          alt=""
          onLoad={handleSlot1Load}
          onError={handleSlot1Error}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            opacity: activeSlot === 1 ? 1 : 0,
            transition: 'opacity 1.5s ease-in-out',
          }}
        />
      )}

      {/* Gradient overlay for text readability */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 70%, rgba(18,18,18,1) 100%)',
          zIndex: 1,
        }}
      />
    </Box>
  )
}
