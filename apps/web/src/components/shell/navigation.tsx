import { filterNavigation } from './navigationRules'
export { pathActive, isEncoreLocation, mobileDestination } from './navigationRules'
import type { ReactElement } from 'react'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined'
import HistoryIcon from '@mui/icons-material/History'
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import WhatshotIcon from '@mui/icons-material/Whatshot'
import InsightsIcon from '@mui/icons-material/Insights'
import AddToQueueIcon from '@mui/icons-material/AddToQueue'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import FactCheckIcon from '@mui/icons-material/FactCheck'
export interface NavItem {
  textKey: string
  icon: ReactElement
  path: string
  feature?: 'emby' | 'watching'
}
export const userNavigation: NavItem[] = [
  { textKey: 'mobile.encore', icon: <AutoAwesomeOutlinedIcon />, path: '/encore' },
  { textKey: 'nav.dashboard', icon: <HomeOutlinedIcon />, path: '/dashboard' },
  { textKey: 'tonight.title', icon: <NightsStayOutlinedIcon />, path: '/tonight', feature: 'emby' },
  { textKey: 'nav.recommendations', icon: <AutoAwesomeOutlinedIcon />, path: '/recommendations' },
  {
    textKey: 'nav.showsYouWatch',
    icon: <AddToQueueIcon />,
    path: '/watching',
    feature: 'watching',
  },
  { textKey: 'nav.topPicks', icon: <WhatshotIcon />, path: '/top-picks' },
  { textKey: 'nav.playlists', icon: <PlaylistPlayIcon />, path: '/playlists' },
  { textKey: 'nav.explore', icon: <HubOutlinedIcon />, path: '/explore' },
  { textKey: 'nav.discover', icon: <ExploreOutlinedIcon />, path: '/discovery' },
  { textKey: 'nav.myRequests', icon: <PlaylistAddCheckIcon />, path: '/my-requests' },
  { textKey: 'nav.browse', icon: <VideoLibraryOutlinedIcon />, path: '/browse' },
  { textKey: 'nav.watchHistory', icon: <HistoryIcon />, path: '/history' },
  { textKey: 'nav.watchStats', icon: <InsightsIcon />, path: '/stats' },
]
export const adminNavigation: NavItem[] = [
  { textKey: 'nav.admin', icon: <AdminPanelSettingsIcon />, path: '/admin' },
  { textKey: 'nav.gapAnalysis', icon: <FactCheckIcon />, path: '/admin/gaps' },
]
export function availableNavigation(provider: string | undefined, watchingEnabled: boolean) {
  return filterNavigation(userNavigation, provider, watchingEnabled)
}
