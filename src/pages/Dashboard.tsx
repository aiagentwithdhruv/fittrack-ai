import { useEffect, useState } from 'react'
import { db, getStat } from '../db'
import { getLevel, calculateStreak, getUnlockedBadges, BADGES, type BadgeStats } from '../engine/gamification'
import { Flame, Trophy, Zap, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [totalXP, setTotalXP] = useState(0)
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [totalReps, setTotalReps] = useState(0)
  const [todayReps, setTodayReps] = useState(0)
  const [todayCals, setTodayCals] = useState(0)
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
      const today = new Date().toISOString().split('T')[0]
      setTodayReps(workouts.filter(w => w.date === today).reduce((s, w) => s + w.reps, 0))

      const meals = await db.nutrition.toArray()
      const todayMeals = meals.filter(m => m.date === today)
      setTodayCals(todayMeals.reduce((s, m) => s + m.calories, 0))
      setTodayProtein(todayMeals.reduce((s, m) => s + m.protein, 0))

      const map: Record<string, number> = {}
      workouts.forEach(w => { map[w.date] = (map[w.date] || 0) + w.reps })
      setHeatmap(map)

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

  // Heatmap: 12 weeks = 84 days
  const heatmapDays: { date: string; reps: number }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const dateStr = d.toISOString().split('T')[0]
    heatmapDays.push({ date: dateStr, reps: heatmap[dateStr] || 0 })
  }

  // Ring helper
  const Ring = ({ pct, color, label, current, target }: { pct: number; color: string; label: string; current: number; target: number }) => {
    const r = 22
    const circ = 2 * Math.PI * r
    const offset = circ - (Math.min(pct, 100) / 100) * circ
    const ringClass = color === '#00ff88' ? 'ring-green' : color === '#ffd93d' ? 'ring-warn' : color === '#f87171' ? 'ring-red' : 'ring-blue'
    return (
      <div className="text-center">
        <svg width="56" height="56" className="mx-auto">
          <circle cx="28" cy="28" r={r} fill="none" className="ring-track" strokeWidth="4" />
          <circle cx="28" cy="28" r={r} fill="none" className={ringClass} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
          <text x="28" y="30" textAnchor="middle" fill={color} fontSize="11" fontWeight="bold">
            {Math.round(pct)}%
          </text>
        </svg>
        <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{current}/{target}</div>
        <div className="text-[9px] text-[var(--color-text-muted)]">{label}</div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3 pb-20">
      {/* Level + XP */}
      <div className="card-glow p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,200,232,0.15), rgba(0,200,232,0.05))', border: '1px solid rgba(0,200,232,0.25)' }}>
              <Zap size={16} className="text-[var(--color-cyan)]" style={{ filter: 'drop-shadow(0 0 6px rgba(0,200,232,0.5))' }} />
            </div>
            <div>
              <span className="font-bold text-sm text-[var(--color-text-primary)]">Level {level}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">{xpInLevel} / {xpForNext} XP</span>
        </div>
        <div className="progress-track h-2">
          <div className="progress-fill h-full" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Daily Targets */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-3">Today's Targets</h3>
        <div className="grid grid-cols-4 gap-2">
          <Ring pct={(todayReps / targets.reps) * 100} color="#00ff88" label="Reps" current={todayReps} target={targets.reps} />
          <Ring pct={(todayCals / targets.calories) * 100} color="#ffd93d" label="Calories" current={todayCals} target={targets.calories} />
          <Ring pct={(todayProtein / targets.protein) * 100} color="#f87171" label="Protein" current={todayProtein} target={targets.protein} />
          <Ring pct={0} color="#60a5fa" label="Water" current={0} target={targets.water} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stat-card p-3 text-center">
          <Flame size={16} className="mx-auto mb-1 text-orange-400" style={{ filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.5))' }} />
          <div className="text-xl font-bold text-orange-400 leading-none">{streak.current}d</div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-1">Streak</div>
        </div>
        <div className="stat-card p-3 text-center">
          <TrendingUp size={16} className="mx-auto mb-1 text-purple-400" style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.5))' }} />
          <div className="text-xl font-bold text-purple-400 leading-none">{unlockedBadges.length}/{BADGES.length}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-1">Badges</div>
        </div>
        <div className="stat-card p-3 text-center">
          <Trophy size={16} className="mx-auto mb-1 text-[var(--color-warn)]" style={{ filter: 'drop-shadow(0 0 6px rgba(255,217,61,0.5))' }} />
          <div className="text-xl font-bold text-glow-warn leading-none">{totalReps}</div>
          <div className="text-[9px] text-[var(--color-text-muted)] mt-1">Total Reps</div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-3">Activity (12 weeks)</h3>
        <div className="grid grid-cols-14 gap-[3px]">
          {heatmapDays.map(({ date, reps }) => (
            <div
              key={date}
              title={`${date}: ${reps} reps`}
              className="heatmap-cell aspect-square"
              style={{
                backgroundColor: reps === 0 ? '#1e1e24' :
                  reps < 20 ? 'rgba(0, 255, 136, 0.15)' :
                  reps < 50 ? 'rgba(0, 255, 136, 0.3)' :
                  reps < 100 ? 'rgba(0, 255, 136, 0.5)' : 'rgba(0, 255, 136, 0.75)',
                border: reps > 0 ? '1px solid rgba(0, 255, 136, 0.1)' : '1px solid rgba(58, 58, 68, 0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-3">Badges</h3>
        <div className="grid grid-cols-6 gap-3">
          {BADGES.map(badge => {
            const unlocked = unlockedBadges.includes(badge.id)
            return (
              <div key={badge.id} className={`text-center ${unlocked ? 'badge-unlocked' : 'badge-locked'}`}>
                <div className="text-xl">{badge.icon}</div>
                <div className="text-[8px] leading-tight mt-0.5 text-[var(--color-text-muted)]">{badge.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
