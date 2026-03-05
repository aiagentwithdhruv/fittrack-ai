import { useState, useEffect } from 'react'
import { db } from '../db'
import { Download, Trash2, Link, Info, Target } from 'lucide-react'

const DEFAULT_TARGETS = { reps: 100, calories: 2000, protein: 120, water: 8 }

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [targetSaved, setTargetSaved] = useState(false)
  const [workoutCount, setWorkoutCount] = useState(0)
  const [nutritionCount, setNutritionCount] = useState(0)
  const [targets, setTargets] = useState(DEFAULT_TARGETS)

  useEffect(() => {
    setWebhookUrl(localStorage.getItem('fittrack_webhook') || '')
    const stored = localStorage.getItem('fittrack_targets')
    if (stored) setTargets(JSON.parse(stored))
    db.workouts.count().then(setWorkoutCount)
    db.nutrition.count().then(setNutritionCount)
  }, [])

  const saveTargets = () => {
    localStorage.setItem('fittrack_targets', JSON.stringify(targets))
    setTargetSaved(true)
    setTimeout(() => setTargetSaved(false), 2000)
  }

  const saveWebhook = () => {
    localStorage.setItem('fittrack_webhook', webhookUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const exportCSV = async () => {
    const workouts = await db.workouts.toArray()
    const csv = 'Date,Exercise,Reps,Sets,Duration,XP\n' +
      workouts.map(w => `${w.date},${w.exercise},${w.reps},${w.sets},${w.duration},${w.xpEarned}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'fittrack_workouts.csv'
    a.click()
  }

  const exportNutrition = async () => {
    const logs = await db.nutrition.toArray()
    const csv = 'Date,Meal,Calories,Protein,Carbs,Fat\n' +
      logs.map(l => `${l.date},${l.mealType},${l.calories},${l.protein},${l.carbs},${l.fat}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'fittrack_nutrition.csv'
    a.click()
  }

  const clearData = async () => {
    if (!confirm('Delete ALL workout and nutrition data? This cannot be undone.')) return
    await db.workouts.clear()
    await db.nutrition.clear()
    await db.stats.clear()
    setWorkoutCount(0)
    setNutritionCount(0)
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Settings</h1>

      {/* Data stats */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2">Your Data</h3>
        <div className="text-sm space-y-1">
          <p>{workoutCount} workouts saved</p>
          <p>{nutritionCount} nutrition logs</p>
          <p className="text-xs text-[var(--color-dim)]">All data stored locally on your device</p>
        </div>
      </div>

      {/* Daily Targets */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="text-xs text-[var(--color-dim)] uppercase mb-3 flex items-center gap-1">
          <Target size={12} /> Daily Targets
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'reps', label: 'Reps', unit: 'reps' },
            { key: 'calories', label: 'Calories', unit: 'kcal' },
            { key: 'protein', label: 'Protein', unit: 'g' },
            { key: 'water', label: 'Water', unit: 'glasses' },
          ] as const).map(({ key, label, unit }) => (
            <div key={key}>
              <label className="text-[0.65rem] text-[var(--color-dim)]">{label} ({unit})</label>
              <input
                type="number"
                value={targets[key]}
                onChange={e => setTargets(t => ({ ...t, [key]: parseInt(e.target.value) || 0 }))}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)] mt-0.5"
              />
            </div>
          ))}
        </div>
        <button onClick={saveTargets} className="mt-3 w-full bg-[var(--color-accent)] text-black rounded-lg py-2 text-sm font-semibold">
          {targetSaved ? 'Saved!' : 'Save Targets'}
        </button>
      </div>

      {/* Webhook */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2 flex items-center gap-1">
          <Link size={12} /> Webhook (n8n / Sheets)
        </h3>
        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-n8n.com/webhook/..."
            className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
          />
          <button onClick={saveWebhook} className="bg-[var(--color-accent)] text-black px-3 rounded text-xs font-semibold">
            {saved ? '✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
        <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2 flex items-center gap-1">
          <Download size={12} /> Export
        </h3>
        <button onClick={exportCSV} className="w-full bg-[var(--color-border)] rounded-lg py-2 text-sm">
          Export Workouts (CSV)
        </button>
        <button onClick={exportNutrition} className="w-full bg-[var(--color-border)] rounded-lg py-2 text-sm">
          Export Nutrition (CSV)
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-[var(--color-card)] border border-red-900/50 rounded-xl p-4">
        <h3 className="text-xs text-red-400 uppercase mb-2 flex items-center gap-1">
          <Trash2 size={12} /> Danger Zone
        </h3>
        <button onClick={clearData} className="w-full bg-red-900/30 border border-red-900 rounded-lg py-2 text-sm text-red-400">
          Delete All Data
        </button>
      </div>

      {/* About */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2 flex items-center gap-1">
          <Info size={12} /> About
        </h3>
        <p className="text-sm">FitTrack AI v1.0.0</p>
        <p className="text-xs text-[var(--color-dim)] mt-1">
          Camera-powered AI fitness tracker. All processing happens on your device.
          No data sent to servers. Built with MediaPipe + React.
        </p>
      </div>
    </div>
  )
}
