import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { theme } from './theme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/Login'
import { HomePage } from './pages/Home'
import { MyRecommendationsPage } from './pages/MyRecommendations'
import { MyWatchHistoryPage } from './pages/MyWatchHistory'
import { MoviesPage } from './pages/Movies'
import { MovieDetailPage } from './pages/movie-detail'
import { PlaylistsPage } from './pages/playlists'
// Admin pages
import { AdminDashboard } from './pages/admin'
import { UsersPage } from './pages/Users'
import { UserDetailPage } from './pages/UserDetail'
import { JobsPage } from './pages/Jobs'
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
        <Route index element={<HomePage />} />
        <Route path="recommendations" element={<MyRecommendationsPage />} />
        <Route path="history" element={<MyWatchHistoryPage />} />
        <Route path="movies" element={<MoviesPage />} />
        <Route path="movies/:id" element={<MovieDetailPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />

        {/* Admin Routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users/:id"
          element={
            <AdminRoute>
              <UserDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/jobs"
          element={
            <AdminRoute>
              <JobsPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />
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
