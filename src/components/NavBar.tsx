import { NavLink } from 'react-router-dom'
import { Dumbbell, LayoutDashboard, Camera, Settings } from 'lucide-react'

const links = [
  { to: '/', icon: Dumbbell, label: 'Workout' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Stats' },
  { to: '/nutrition', icon: Camera, label: 'Nutrition' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-card)] border-t border-[var(--color-border)] flex justify-around py-2 px-4 z-50 safe-area-bottom">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[0.65rem] transition-colors ${
              isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-dim)]'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
