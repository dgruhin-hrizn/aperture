import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/dashboard'
import { MyRecommendationsPage } from './pages/MyRecommendations'
import { MyWatchHistoryPage } from './pages/MyWatchHistory'
import { MoviesPage } from './pages/Movies'
import { SeriesPage } from './pages/Series'
import { MovieDetailPage } from './pages/movie-detail'
import { SeriesDetailPage } from './pages/series-detail'
import { PlaylistsPage } from './pages/playlists'
import { UserSettingsPage } from './pages/UserSettings'
import { TopPicksMoviesPage, TopPicksSeriesPage } from './pages/top-picks'
import { WatchStatsPage } from './pages/WatchStats'
// Admin pages
import { AdminDashboard } from './pages/admin'
import { UsersPage } from './pages/Users'
import { UserDetailPage } from './pages/UserDetail'
import { JobsPage } from './pages/jobs'
import { SettingsPage } from './pages/settings'
import { Box, CircularProgress } from '@mui/material'

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

  return <>{children}</>
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
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* User Routes */}
        <Route index element={<DashboardPage />} />
        <Route path="recommendations" element={<MyRecommendationsPage />} />
        <Route path="top-picks/movies" element={<TopPicksMoviesPage />} />
        <Route path="top-picks/series" element={<TopPicksSeriesPage />} />
        <Route path="history" element={<MyWatchHistoryPage />} />
        <Route path="stats" element={<WatchStatsPage />} />
        <Route path="movies" element={<MoviesPage />} />
        <Route path="movies/:id" element={<MovieDetailPage />} />
        <Route path="series" element={<SeriesPage />} />
        <Route path="series/:id" element={<SeriesDetailPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
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
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
