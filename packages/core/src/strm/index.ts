export {
  writeStrmFilesForUser,
  ensureUserLibrary,
  refreshUserLibrary,
  updateUserLibraryPermissions,
  processStrmForAllUsers,
  // Series STRM exports
  writeSeriesStrmFilesForUser,
  ensureUserSeriesLibrary,
  refreshUserSeriesLibrary,
  updateUserSeriesLibraryPermissions,
  processSeriesStrmForAllUsers,
  // Types for library creation transparency
  type UserLibraryResult,
  type ProcessStrmResult,
} from './StrmWriter.js'

export {
  cleanupUserLibraries,
  reconcileStaleStrmLibraries,
  type StrmLibraryMediaType,
} from './cleanup.js'

