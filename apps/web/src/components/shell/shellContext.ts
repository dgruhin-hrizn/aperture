import type { NavItem } from './navigation'
export interface ShellContext {
  items: NavItem[]
  onWelcome: () => void
}
