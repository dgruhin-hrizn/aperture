import { useContext } from 'react'
import { UserRatingsContext } from './user-ratings-context'

export function useUserRatings() {
  const context = useContext(UserRatingsContext)
  if (!context) {
    throw new Error('useUserRatings must be used within a UserRatingsProvider')
  }
  return context
}
