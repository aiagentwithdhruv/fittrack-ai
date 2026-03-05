import { useState, useEffect } from 'react'
import { db } from '../db'
import { Download, Trash2, Link, Info, Target, Database, Check } from 'lucide-react'

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

  const SectionIcon = ({ icon: Icon, color }: { icon: typeof Target; color: string }) => (
    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)`, border: `1px solid ${color}40` }}>
      <Icon size={12} style={{ color }} />
    </div>
  )

  return (
    <div className="p-3 space-y-3 pb-20">
      <h1 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Settings</h1>

      {/* Data stats */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2.5 flex items-center gap-2">
          <SectionIcon icon={Database} color="#00c8e8" /> Your Data
        </h3>
        <div className="text-sm space-y-1.5 text-[var(--color-text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Workouts saved</span>
            <span className="text-glow-cyan font-semibold">{workoutCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Nutrition logs</span>
            <span className="text-glow-cyan font-semibold">{nutritionCount}</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] pt-1">All data stored locally on your device</p>
        </div>
      </div>

      {/* Daily Targets */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2">
          <SectionIcon icon={Target} color="#00ff88" /> Daily Targets
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'reps', label: 'Reps', unit: 'reps' },
            { key: 'calories', label: 'Calories', unit: 'kcal' },
            { key: 'protein', label: 'Protein', unit: 'g' },
            { key: 'water', label: 'Water', unit: 'glasses' },
          ] as const).map(({ key, label, unit }) => (
            <div key={key}>
              <label className="text-[10px] text-[var(--color-text-muted)]">{label} ({unit})</label>
              <input
                type="number"
                value={targets[key]}
                onChange={e => setTargets(t => ({ ...t, [key]: parseInt(e.target.value) || 0 }))}
                className="input-glow w-full px-3 py-2 text-sm mt-1"
              />
            </div>
          ))}
        </div>
        <button onClick={saveTargets} className="mt-3 w-full btn-accent py-2.5 text-sm flex items-center justify-center gap-1.5">
          {targetSaved ? <><Check size={14} /> Saved!</> : 'Save Targets'}
        </button>
      </div>

      {/* Webhook */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2.5 flex items-center gap-2">
          <SectionIcon icon={Link} color="#a78bfa" /> Webhook (n8n / Sheets)
        </h3>
        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-n8n.com/webhook/..."
            className="input-glow flex-1 px-3 py-2 text-xs"
          />
          <button onClick={saveWebhook} className="btn-primary px-4 text-xs flex items-center gap-1">
            {saved ? <><Check size={12} /></> : 'Save'}
          </button>
        </div>
      </div>

      {/* Export */}
      <div className="card-glow p-4 space-y-2.5">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2 flex items-center gap-2">
          <SectionIcon icon={Download} color="#60a5fa" /> Export
        </h3>
        <button onClick={exportCSV} className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <Download size={14} /> Export Workouts (CSV)
        </button>
        <button onClick={exportNutrition} className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <Download size={14} /> Export Nutrition (CSV)
        </button>
      </div>

      {/* Danger zone */}
      <div className="card-glow p-4" style={{ borderColor: 'rgba(255,71,87,0.2)' }}>
        <h3 className="text-[9px] font-medium tracking-widest uppercase mb-2.5 flex items-center gap-2 text-glow-danger">
          <SectionIcon icon={Trash2} color="#ff4757" /> Danger Zone
        </h3>
        <button onClick={clearData} className="btn-danger w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <Trash2 size={14} /> Delete All Data
        </button>
      </div>

      {/* About */}
      <div className="card-glow p-4">
        <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2 flex items-center gap-2">
          <SectionIcon icon={Info} color="#00c8e8" /> About
        </h3>
        <p className="text-sm text-[var(--color-text-primary)]">FitTrack AI v1.0.0</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
          Camera-powered AI fitness tracker. All processing happens on your device.
          No data sent to servers. Built with MediaPipe + React.
        </p>
      </div>
    </div>
  )
}
