export type NavSection = '/' | '/home/all' | '/teams' | '/matches' | '/inbox' | '/me' | '/admin'

const isRouteOrChild = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`)

export function navSection(pathname: string): NavSection | null {
  if (pathname === '/') return '/'
  if (['/home', '/t', '/watch', '/mvp'].some(route => isRouteOrChild(pathname, route))) return '/home/all'
  if (['/teams', '/team'].some(route => isRouteOrChild(pathname, route))) return '/teams'
  if (['/matches', '/m', '/checkin'].some(route => isRouteOrChild(pathname, route))) return '/matches'
  if (isRouteOrChild(pathname, '/inbox')) return '/inbox'
  if (isRouteOrChild(pathname, '/me')) return '/me'
  if (isRouteOrChild(pathname, '/admin')) return '/admin'
  return null
}
