// XP System: consistency > intensity
export const XP_PER_WORKOUT = 100
export const XP_PER_REP = 2
export const XP_BONUS_HARD = 20  // > 30 reps
export const XP_STREAK_MULTIPLIER = 1.1 // 10% bonus per streak day (max 2x)

export function calculateXP(reps: number, streakDays: number): number {
  const base = XP_PER_WORKOUT + (reps * XP_PER_REP)
  const hard = reps > 30 ? XP_BONUS_HARD : 0
  const multiplier = Math.min(2, 1 + (streakDays * 0.1))
  return Math.round((base + hard) * multiplier)
}

export function getLevel(totalXP: number): { level: number; xpInLevel: number; xpForNext: number } {
  // Each level needs more XP: level N needs N*200 XP
  let xp = totalXP
  let level = 1
  while (xp >= level * 200) {
    xp -= level * 200
    level++
  }
  return { level, xpInLevel: xp, xpForNext: level * 200 }
}

// Badges
export interface Badge {
  id: string
  name: string
  icon: string
  description: string
  condition: (stats: BadgeStats) => boolean
}

export interface BadgeStats {
  totalReps: number
  totalWorkouts: number
  currentStreak: number
  longestStreak: number
  totalXP: number
  exercises: string[]
}

export const BADGES: Badge[] = [
  { id: 'first5', name: 'First 5', icon: '💪', description: 'Complete 5 reps', condition: s => s.totalReps >= 5 },
  { id: 'first50', name: 'Half Century', icon: '🔥', description: '50 total reps', condition: s => s.totalReps >= 50 },
  { id: 'century', name: 'Century Club', icon: '💯', description: '100 total reps', condition: s => s.totalReps >= 100 },
  { id: 'fivehundred', name: 'Iron Will', icon: '🏋️', description: '500 total reps', condition: s => s.totalReps >= 500 },
  { id: 'thousand', name: 'Machine', icon: '🤖', description: '1000 total reps', condition: s => s.totalReps >= 1000 },
  { id: 'streak3', name: 'Hat Trick', icon: '🎯', description: '3-day streak', condition: s => s.currentStreak >= 3 },
  { id: 'streak7', name: 'Week Warrior', icon: '⚡', description: '7-day streak', condition: s => s.currentStreak >= 7 },
  { id: 'streak30', name: 'Iron Habit', icon: '🏆', description: '30-day streak', condition: s => s.currentStreak >= 30 },
  { id: 'workout10', name: 'Regular', icon: '📅', description: '10 workouts', condition: s => s.totalWorkouts >= 10 },
  { id: 'workout50', name: 'Dedicated', icon: '⭐', description: '50 workouts', condition: s => s.totalWorkouts >= 50 },
  { id: 'level5', name: 'Rising Star', icon: '🌟', description: 'Reach level 5', condition: s => getLevel(s.totalXP).level >= 5 },
  { id: 'level10', name: 'Elite', icon: '👑', description: 'Reach level 10', condition: s => getLevel(s.totalXP).level >= 10 },
]

export function getUnlockedBadges(stats: BadgeStats): Badge[] {
  return BADGES.filter(b => b.condition(stats))
}

// Streak calculation
export function calculateStreak(workoutDates: string[]): { current: number; longest: number } {
  if (workoutDates.length === 0) return { current: 0, longest: 0 }
  
  const unique = [...new Set(workoutDates)].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  
  // Current streak: must include today or yesterday
  let current = 0
  if (unique[0] === today || unique[0] === yesterday) {
    current = 1
    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1])
      const curr = new Date(unique[i])
      const diff = (prev.getTime() - curr.getTime()) / 86400000
      if (diff === 1) current++
      else break
    }
  }
  
  // Longest streak
  let longest = 0
  let streak = 1
  const sorted = [...new Set(workoutDates)].sort()
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    if ((curr.getTime() - prev.getTime()) / 86400000 === 1) streak++
    else streak = 1
    longest = Math.max(longest, streak)
  }
  longest = Math.max(longest, current)
  
  return { current, longest }
}
