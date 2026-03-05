import Dexie, { type EntityTable } from 'dexie'

export interface Workout {
  id?: number
  date: string        // YYYY-MM-DD
  exercise: string    // pushup, squat, situp
  reps: number
  sets: number
  duration: number    // seconds
  avgSpeed: number | null
  xpEarned: number
  createdAt: string   // ISO
}

export interface UserStats {
  id?: number
  key: string
  value: string
}

export interface NutritionLog {
  id?: number
  date: string
  mealType: string    // breakfast, lunch, dinner, snack
  photoUrl: string | null
  foods: string       // JSON array of detected foods
  calories: number
  protein: number
  carbs: number
  fat: number
  recommendation: string
  createdAt: string
}

const db = new Dexie('FitTrackDB') as Dexie & {
  workouts: EntityTable<Workout, 'id'>
  stats: EntityTable<UserStats, 'id'>
  nutrition: EntityTable<NutritionLog, 'id'>
}

db.version(1).stores({
  workouts: '++id, date, exercise, createdAt',
  stats: '++id, &key',
  nutrition: '++id, date, mealType, createdAt',
})

export { db }

// Helper: get or set a stat
export async function getStat(key: string, fallback = '0'): Promise<string> {
  const row = await db.stats.where('key').equals(key).first()
  return row?.value ?? fallback
}

export async function setStat(key: string, value: string) {
  const existing = await db.stats.where('key').equals(key).first()
  if (existing) await db.stats.update(existing.id!, { value })
  else await db.stats.add({ key, value })
}

// Helper: get today's workouts
export async function getTodayWorkouts(): Promise<Workout[]> {
  const today = new Date().toISOString().split('T')[0]
  return db.workouts.where('date').equals(today).toArray()
}

// Helper: get total reps today
export async function getTodayReps(): Promise<number> {
  const workouts = await getTodayWorkouts()
  return workouts.reduce((sum, w) => sum + w.reps, 0)
}
