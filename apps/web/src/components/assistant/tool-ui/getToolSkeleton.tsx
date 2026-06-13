import type { ReactNode } from 'react'
import {
  ContentCarouselSkeleton,
  ContentDetailSkeleton,
  PersonResultSkeleton,
  StatsSkeleton,
  StudiosSkeleton,
} from './ToolSkeletons'

export function getToolSkeleton(toolName: string): ReactNode {
  switch (toolName) {
    // Content carousel tools
    case 'searchContent':
    case 'findSimilarContent':
    case 'getMyRecommendations':
    case 'getWatchHistory':
    case 'getUserRatings':
    case 'getUnwatched':
    case 'getContentRankings':
      return <ContentCarouselSkeleton />

    // Content detail tool
    case 'getContentDetails':
      return <ContentDetailSkeleton />

    // Person search
    case 'searchPeople':
      return <PersonResultSkeleton />

    // Stats
    case 'getLibraryStats':
      return <StatsSkeleton />

    // Studios/networks
    case 'getTopStudios':
    case 'getTopNetworks':
      return <StudiosSkeleton />

    // Default - generic loading skeleton
    default:
      return <ContentCarouselSkeleton />
  }
}
