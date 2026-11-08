export function filterNavigation<T extends { feature?: 'emby' | 'watching' }>(
  items: readonly T[],
  provider: string | undefined,
  watchingEnabled: boolean
) {
  return items.filter(
    (item) =>
      (item.feature !== 'emby' || provider === 'emby') &&
      (item.feature !== 'watching' || watchingEnabled)
  )
}
export function pathActive(pathname: string, path: string) {
  if (path === '/dashboard' && pathname === '/') return true
  if (path === '/admin' && pathname.startsWith('/admin/gaps')) return false
  return pathname === path || pathname.startsWith(path + '/')
}
export function isEncoreLocation(pathname: string) {
  return pathname === '/encore'
}
export function mobileDestination(pathname: string, watchingEnabled: boolean) {
  if (isEncoreLocation(pathname)) return 'encore'
  if (['/discovery', '/explore', '/top-picks'].some((path) => pathActive(pathname, path)))
    return 'discover'
  if (
    ['/browse', '/movies', '/series', '/person', '/studio', '/search', '/franchises'].some((path) =>
      pathActive(pathname, path)
    )
  )
    return 'library'
  if (pathActive(pathname, watchingEnabled ? '/watching' : '/recommendations')) return 'watching'
  return 'you'
}
