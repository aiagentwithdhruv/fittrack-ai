import { useEffect, useState } from 'react'
import { db, getStat } from '../db'
import { getLevel, calculateStreak, getUnlockedBadges, BADGES, type BadgeStats } from '../engine/gamification'
import { Flame, Trophy, Zap, TrendingUp, Utensils } from 'lucide-react'

export default function Dashboard() {
  const [totalXP, setTotalXP] = useState(0)
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [totalReps, setTotalReps] = useState(0)
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [todayReps, setTodayReps] = useState(0)
  const [todayCals, setTodayCals] = useState(0)
  const [totalMeals, setTotalMeals] = useState(0)
  const [todayProtein, setTodayProtein] = useState(0)
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([])
  const [heatmap, setHeatmap] = useState<Record<string, number>>({})
  const [targets, setTargets] = useState({ reps: 100, calories: 2000, protein: 120, water: 8 })

  useEffect(() => {
    const stored = localStorage.getItem('fittrack_targets')
    if (stored) setTargets(JSON.parse(stored))
    const load = async () => {
      const xp = parseInt(await getStat('totalXP', '0'))
      setTotalXP(xp)

      const workouts = await db.workouts.toArray()
      const dates = workouts.map(w => w.date)
      setStreak(calculateStreak(dates))
      setTotalReps(workouts.reduce((s, w) => s + w.reps, 0))
      setTotalWorkouts(new Set(dates).size)

      const today = new Date().toISOString().split('T')[0]
      setTodayReps(workouts.filter(w => w.date === today).reduce((s, w) => s + w.reps, 0))

      // Nutrition
      const meals = await db.nutrition.toArray()
      setTotalMeals(meals.length)
      const todayMeals = meals.filter(m => m.date === today)
      setTodayCals(todayMeals.reduce((s, m) => s + m.calories, 0))
      setTodayProtein(todayMeals.reduce((s, m) => s + m.protein, 0))

      // Heatmap
      const map: Record<string, number> = {}
      workouts.forEach(w => { map[w.date] = (map[w.date] || 0) + w.reps })
      setHeatmap(map)

      // Badges
      const stats: BadgeStats = {
        totalReps: workouts.reduce((s, w) => s + w.reps, 0),
        totalWorkouts: new Set(dates).size,
        currentStreak: calculateStreak(dates).current,
        longestStreak: calculateStreak(dates).longest,
        totalXP: xp,
        exercises: [...new Set(workouts.map(w => w.exercise))],
      }
      setUnlockedBadges(getUnlockedBadges(stats).map(b => b.id))
    }
    load()
  }, [])

  const { level, xpInLevel, xpForNext } = getLevel(totalXP)
  const xpPercent = Math.round((xpInLevel / xpForNext) * 100)

  // Generate heatmap grid (12 weeks = 84 days)
  const heatmapDays: { date: string; reps: number }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().split('T')[0]
    heatmapDays.push({ date: dateStr, reps: heatmap[dateStr] || 0 })
  }

  return (
    <div className="p-3 space-y-2.5">
      {/* Level + XP — compact */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap size={16} className="text-[var(--color-accent)]" />
            <span className="font-bold">Level {level}</span>
          </div>
          <span className="text-[0.65rem] text-[var(--color-dim)]">{xpInLevel} / {xpForNext} XP</span>
        </div>
        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Daily Targets */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
        <h3 className="text-[0.6rem] text-[var(--color-dim)] uppercase tracking-wider mb-2">Today's Targets</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Reps', current: todayReps, target: targets.reps, color: '#00ff88' },
            { label: 'Calories', current: todayCals, target: targets.calories, color: '#ffd93d' },
            { label: 'Protein', current: todayProtein, target: targets.protein, color: '#f87171' },
            { label: 'Water', current: 0, target: targets.water, color: '#60a5fa' },
          ].map(({ label, current, target, color }) => {
            const pct = Math.min((current / target) * 100, 100)
            const r = 22
            const circ = 2 * Math.PI * r
            const offset = circ - (pct / 100) * circ
            return (
              <div key={label} className="text-center">
                <svg width="56" height="56" className="mx-auto">
                  <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-border)" strokeWidth="4" />
                  <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(-90 28 28)"
                    className="transition-all duration-500" />
                  <text x="28" y="30" textAnchor="middle" fill={color} fontSize="11" fontWeight="bold">
                    {Math.round(pct)}%
                  </text>
                </svg>
                <div className="text-[0.5rem] text-[var(--color-dim)] mt-0.5">{current}/{target}</div>
                <div className="text-[0.5rem] text-[var(--color-dim)]">{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Flame, label: 'Streak', value: `${streak.current}d`, color: 'text-orange-400' },
          { icon: Zap, label: 'Badges', value: `${unlockedBadges.length}/${BADGES.length}`, color: 'text-purple-400' },
          { icon: Trophy, label: 'Total', value: `${totalReps}`, color: 'text-[var(--color-warn)]' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2.5 text-center">
            <Icon size={14} className={`${color} mx-auto mb-1`} />
            <div className={`text-lg font-bold ${color} leading-none`}>{value}</div>
            <div className="text-[0.55rem] text-[var(--color-dim)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Activity Heatmap — compact */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
        <h3 className="text-[0.6rem] text-[var(--color-dim)] uppercase tracking-wider mb-2">Activity (12 weeks)</h3>
        <div className="grid grid-cols-14 gap-[3px]">
          {heatmapDays.map(({ date, reps }) => (
            <div
              key={date}
              title={`${date}: ${reps} reps`}
              className="aspect-square rounded-[2px]"
              style={{
                backgroundColor: reps === 0 ? 'var(--color-border)' :
                  reps < 20 ? '#0e4429' :
                  reps < 50 ? '#006d32' :
                  reps < 100 ? '#26a641' : '#39d353',
              }}
            />
          ))}
        </div>
      </div>

      {/* Badges — compact grid */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
        <h3 className="text-[0.6rem] text-[var(--color-dim)] uppercase tracking-wider mb-2">Badges</h3>
        <div className="grid grid-cols-6 gap-2">
          {BADGES.map(badge => {
            const unlocked = unlockedBadges.includes(badge.id)
            return (
              <div key={badge.id} className={`text-center ${unlocked ? '' : 'opacity-25'}`}>
                <div className="text-xl">{badge.icon}</div>
                <div className="text-[0.45rem] leading-tight mt-0.5">{badge.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
