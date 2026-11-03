import { getSystemSetting, setSystemSetting } from '../../settings/systemSettings.js'

export interface SeriesRecommendationGroup {
  id: string
  name: string
  sourceIds: string[]
}

const setting = 'series_recommendation_groups'

export async function getSeriesRecommendationGroups(): Promise<SeriesRecommendationGroup[]> {
  const value = await getSystemSetting(setting)
  return value ? JSON.parse(value) : []
}

export async function setSeriesRecommendationGroups(groups: SeriesRecommendationGroup[]): Promise<void> {
  await setSystemSetting(setting, JSON.stringify(groups), 'Source groups for Emby TV recommendation libraries')
}
