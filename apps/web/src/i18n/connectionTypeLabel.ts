import type { TFunction } from 'i18next'
import type { ConnectionType } from '../components/SimilarityGraph/types'

export function connectionTypeLabel(type: ConnectionType, t: TFunction): string {
  return t(`connectionTypes.${type}`)
}
