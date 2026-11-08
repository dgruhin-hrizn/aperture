import React, { lazy, Suspense } from 'react'
import { PageLoading } from './components/PageLoading'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n/config'
import { RtlProviders } from './RtlProviders'
import { AppearanceProvider } from './appearance/AppearanceProvider'
import { AuthProvider } from './hooks/AuthProvider'
import { useAuth } from './hooks/useAuth'
import { WatchingProvider } from './hooks/useWatching'
import { SetupProvider } from './hooks/SetupProvider'
import { useSetupStatus } from './hooks/useSetupStatus'
import { UserRatingsProvider } from './hooks/UserRatingsProvider'
import { ViewModeProvider } from './hooks/ViewModeProvider'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
const AccountHub = lazy(() => import('./pages/AccountHub').then(module => ({ default: module.AccountHub })))
const LoginPage = lazy(() => import('./pages/Login').then(module => ({ default: module.LoginPage })))
const SetupPage = lazy(() => import('./pages/setup').then(module => ({ default: module.SetupPage })))
const TonightPage = lazy(() => import('./pages/Tonight').then(module => ({ default: module.TonightPage })))
const DashboardPage = lazy(() => import('./pages/dashboard').then(module => ({ default: module.DashboardPage })))
const MyRecommendationsPage = lazy(() => import('./pages/MyRecommendations').then(module => ({ default: module.MyRecommendationsPage })))
const MyWatchHistoryPage = lazy(() => import('./pages/MyWatchHistory').then(module => ({ default: module.MyWatchHistoryPage })))
const MoviesPage = lazy(() => import('./pages/Movies').then(module => ({ default: module.MoviesPage })))
const SeriesPage = lazy(() => import('./pages/Series').then(module => ({ default: module.SeriesPage })))
const MovieDetailPage = lazy(() => import('./pages/media-detail').then(module => ({ default: module.MovieDetailPage })))
const SeriesDetailPage = lazy(() => import('./pages/media-detail').then(module => ({ default: module.SeriesDetailPage })))
const PlaylistsPage = lazy(() => import('./pages/playlists').then(module => ({ default: module.PlaylistsPage })))
const UserSettingsPage = lazy(() => import('./pages/UserSettings').then(module => ({ default: module.UserSettingsPage })))
const TopPicksMoviesPage = lazy(() => import('./pages/top-picks').then(module => ({ default: module.TopPicksMoviesPage })))
const TopPicksSeriesPage = lazy(() => import('./pages/top-picks').then(module => ({ default: module.TopPicksSeriesPage })))
const TopPicksPage = lazy(() => import('./pages/top-picks').then(module => ({ default: module.TopPicksPage })))
const BrowsePage = lazy(() => import('./pages/Browse').then(module => ({ default: module.BrowsePage })))
const WatchStatsPage = lazy(() => import('./pages/WatchStats').then(module => ({ default: module.WatchStatsPage })))
const SearchPage = lazy(() => import('./pages/Search').then(module => ({ default: module.SearchPage })))
const FranchisesPage = lazy(() => import('./pages/Franchises').then(module => ({ default: module.FranchisesPage })))
const WatchingPage = lazy(() => import('./pages/watching').then(module => ({ default: module.WatchingPage })))
const PersonDetailPage = lazy(() => import('./pages/PersonDetail').then(module => ({ default: module.PersonDetailPage })))
const StudioDetailPage = lazy(() => import('./pages/StudioDetail').then(module => ({ default: module.StudioDetailPage })))
const ExplorePage = lazy(() => import('./pages/explore').then(module => ({ default: module.ExplorePage })))
const DiscoveryPage = lazy(() => import('./pages/discovery').then(module => ({ default: module.DiscoveryPage })))
const MyRequestsPage = lazy(() => import('./pages/MyRequests').then(module => ({ default: module.MyRequestsPage })))
// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin').then(module => ({ default: module.AdminDashboard })))
const UsersPage = lazy(() => import('./pages/Users').then(module => ({ default: module.UsersPage })))
const UserDetailPage = lazy(() => import('./pages/UserDetail').then(module => ({ default: module.UserDetailPage })))
const JobsPage = lazy(() => import('./pages/jobs').then(module => ({ default: module.JobsPage })))
const SettingsPage = lazy(() => import('./pages/settings').then(module => ({ default: module.SettingsPage })))
const GapAnalysisPage = lazy(() => import('./pages/admin/GapAnalysisPage').then(module => ({ default: module.GapAnalysisPage })))
import { Box, CircularProgress } from '@mui/material'

function IndexRoute(){
  return <DashboardPage/>
}

function SetupGuard({ children }: { children: React.ReactNode }) {
  const { status, loading } = useSetupStatus()

  if (loading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    )
  }

  // Redirect to setup if needed
  if (status?.needsSetup) {
    return <Navigate to="/setup" replace />
  }

  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Wrap with providers so state is available everywhere
  return (
    <ViewModeProvider>
      <UserRatingsProvider>
        <WatchingProvider>
          {children}
        </WatchingProvider>
      </UserRatingsProvider>
    </ViewModeProvider>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      <Route
        path="/"
        element={
          <SetupGuard>
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          </SetupGuard>
        }
      >
        {/* User Routes */}
        <Route index element={<IndexRoute />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="encore" element={null} />
        <Route path="you" element={<AccountHub />} />
        <Route path="tonight" element={<TonightPage />} />
        <Route path="recommendations" element={<MyRecommendationsPage />} />
        <Route path="watching" element={<WatchingPage />} />
        <Route path="top-picks" element={<TopPicksPage />} />
        <Route path="top-picks/movies" element={<TopPicksMoviesPage />} />
        <Route path="top-picks/series" element={<TopPicksSeriesPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="discovery" element={<DiscoveryPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="movies" element={<MoviesPage />} />
        <Route path="movies/:id" element={<MovieDetailPage />} />
        <Route path="series" element={<SeriesPage />} />
        <Route path="series/:id" element={<SeriesDetailPage />} />
        <Route path="history" element={<MyWatchHistoryPage />} />
        <Route path="stats" element={<WatchStatsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="franchises" element={<FranchisesPage />} />
        <Route path="person/:name" element={<PersonDetailPage />} />
        <Route path="studio/:name" element={<StudioDetailPage />} />
        <Route path="settings" element={<UserSettingsPage />} />

        {/* Admin Routes - nested under AdminLayout */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="gaps" element={<GapAnalysisPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <SetupProvider>
          <AuthProvider>
            <AppearanceProvider>
              <RtlProviders>
                <Suspense fallback={<PageLoading />}><AppRoutes /></Suspense>
              </RtlProviders>
            </AppearanceProvider>
          </AuthProvider>
        </SetupProvider>
      </BrowserRouter>
    </I18nextProvider>
  )
}
