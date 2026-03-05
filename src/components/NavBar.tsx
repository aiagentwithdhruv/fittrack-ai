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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-steel-dark)]"
      style={{
        background: 'linear-gradient(to top, #0a0a0f 0%, #141418 100%)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex h-[60px]">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-tab flex-1 flex flex-col items-center justify-center gap-1 ${
                isActive ? 'active' : 'text-[var(--color-text-muted)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  className={isActive ? 'text-[var(--color-cyan)]' : ''}
                  style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(0, 200, 232, 0.6))' } : {}}
                />
                <span className={`text-[10px] font-medium ${isActive ? 'text-[var(--color-cyan)]' : ''}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
