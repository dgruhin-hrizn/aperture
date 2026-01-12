/**
 * RotatingBackdrop Component
 * 
 * Displays rotating fanart backdrop images with smooth crossfade transitions.
 * Used on person and studio detail page headers.
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
  // Filter out null/undefined URLs and limit to 10
  const validUrls = backdropUrls
    .filter((url): url is string => !!url)
    .slice(0, 20)

  // Shuffle on mount for variety
  const [shuffledUrls] = useState(() => shuffleArray(validUrls))
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const intervalRef = useRef<number | null>(null)

  // Get URLs with proxy
  const getUrl = useCallback((index: number) => {
    if (index >= shuffledUrls.length) return null
    return getProxiedImageUrl(shuffledUrls[index], '')
  }, [shuffledUrls])

  // Preload an image
  const preloadImage = useCallback((url: string) => {
    if (loadedImages.has(url) || failedImages.has(url)) return
    
    const img = new Image()
    img.onload = () => {
      setLoadedImages(prev => new Set(prev).add(url))
    }
    img.onerror = () => {
      setFailedImages(prev => new Set(prev).add(url))
    }
    img.src = url
  }, [loadedImages, failedImages])

  // Find next valid index (skip failed images)
  const findNextValidIndex = useCallback((fromIndex: number): number => {
    if (shuffledUrls.length === 0) return 0
    
    let nextIdx = (fromIndex + 1) % shuffledUrls.length
    let attempts = 0
    
    while (attempts < shuffledUrls.length) {
      const url = getUrl(nextIdx)
      if (url && !failedImages.has(url)) {
        return nextIdx
      }
      nextIdx = (nextIdx + 1) % shuffledUrls.length
      attempts++
    }
    
    return fromIndex // All images failed, stay on current
  }, [shuffledUrls.length, getUrl, failedImages])

  // Start rotation
  useEffect(() => {
    if (shuffledUrls.length <= 1) return

    // Preload first few images
    shuffledUrls.slice(0, 3).forEach(url => {
      const proxied = getProxiedImageUrl(url, '')
      if (proxied) preloadImage(proxied)
    })

    intervalRef.current = window.setInterval(() => {
      setIsTransitioning(true)
      
      // After transition completes, update indices
      setTimeout(() => {
        setCurrentIndex(prev => {
          const next = findNextValidIndex(prev)
          // Preload the one after next
          const afterNext = findNextValidIndex(next)
          const afterNextUrl = getUrl(afterNext)
          if (afterNextUrl) preloadImage(afterNextUrl)
          return next
        })
        setIsTransitioning(false)
      }, 1000) // Match CSS transition duration
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [shuffledUrls, interval, preloadImage, findNextValidIndex, getUrl])

  // Update next index when current changes
  useEffect(() => {
    setNextIndex(findNextValidIndex(currentIndex))
  }, [currentIndex, findNextValidIndex])

  // Don't render if no valid URLs
  if (shuffledUrls.length === 0) {
    return null
  }

  const currentUrl = getUrl(currentIndex)
  const nextUrl = getUrl(nextIndex)

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
      {/* Current image */}
      {currentUrl && !failedImages.has(currentUrl) && (
        <Box
          component="img"
          src={currentUrl}
          alt=""
          onError={() => setFailedImages(prev => new Set(prev).add(currentUrl))}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            opacity: isTransitioning ? 0 : 1,
            transition: 'opacity 1s ease-in-out',
          }}
        />
      )}

      {/* Next image (for crossfade) */}
      {nextUrl && !failedImages.has(nextUrl) && shuffledUrls.length > 1 && (
        <Box
          component="img"
          src={nextUrl}
          alt=""
          onError={() => setFailedImages(prev => new Set(prev).add(nextUrl))}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            opacity: isTransitioning ? 1 : 0,
            transition: 'opacity 1s ease-in-out',
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

