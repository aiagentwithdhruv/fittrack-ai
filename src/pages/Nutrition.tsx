import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, Utensils, X, Key, Zap, Check, AlertTriangle } from 'lucide-react'
import { db, type NutritionLog } from '../db'

interface FoodItem {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  good: boolean
  reason: string
}

interface AnalysisResult {
  foods: FoodItem[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  recommendation: string
  eatThis: string[]
  avoidThis: string[]
}

export default function Nutrition() {
  const [photo, setPhoto] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [logs, setLogs] = useState<NutritionLog[]>([])
  const [apiKey, setApiKey] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const key = localStorage.getItem('fittrack_openrouter_key') || ''
    setApiKey(key)
    db.nutrition.orderBy('createdAt').reverse().limit(10).toArray().then(setLogs)
  }, [])

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setAnalysis(null)
    }
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!photo) return
    const key = apiKey || localStorage.getItem('fittrack_openrouter_key') || ''
    if (!key) { setShowConfig(true); return }

    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'x-ai/grok-4.1-fast',
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: photo } },
                { type: 'text', text: `Analyze this food image. Return ONLY valid JSON (no markdown, no backticks):
{
  "foods": [{"name": "food name", "calories": 200, "protein": 10, "carbs": 25, "fat": 8, "good": true, "reason": "why good/bad"}],
  "totalCalories": 500,
  "totalProtein": 25,
  "totalCarbs": 60,
  "totalFat": 15,
  "recommendation": "Overall assessment for fitness goals. Be specific about what to eat more/less of.",
  "eatThis": ["food suggestions to eat today"],
  "avoidThis": ["foods to avoid based on what's in the image"]
}
Be accurate with calories. Assume standard portions. Focus on fitness/muscle building goals.` }
              ],
            }],
            temperature: 0.1,
          }),
        }
      )

      const data = await response.json()

      if (data.error) {
        setError(`API Error: ${data.error.message || JSON.stringify(data.error)}`)
        setAnalyzing(false)
        return
      }

      const text = data.choices?.[0]?.message?.content
      if (!text) {
        setError('No response. Check your OpenRouter API key.')
        setAnalyzing(false)
        return
      }

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result: AnalysisResult = JSON.parse(cleaned)
      setAnalysis(result)

      await db.nutrition.add({
        date: new Date().toISOString().split('T')[0],
        mealType: 'meal',
        photoUrl: photo.substring(0, 100),
        foods: JSON.stringify(result.foods),
        calories: result.totalCalories,
        protein: result.totalProtein,
        carbs: result.totalCarbs,
        fat: result.totalFat,
        recommendation: result.recommendation,
        createdAt: new Date().toISOString(),
      })

      const updated = await db.nutrition.orderBy('createdAt').reverse().limit(10).toArray()
      setLogs(updated)
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze. Check API key and try again.')
      setAnalysis(null)
    }
    setAnalyzing(false)
  }

  const todayCalories = logs
    .filter(l => l.date === new Date().toISOString().split('T')[0])
    .reduce((s, l) => s + l.calories, 0)

  return (
    <div className="p-3 space-y-3 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,200,232,0.15), rgba(0,200,232,0.05))', border: '1px solid rgba(0,200,232,0.25)' }}>
            <Utensils size={14} className="text-[var(--color-cyan)]" />
          </div>
          Nutrition
        </h1>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn-ghost px-2.5 py-1.5 flex items-center gap-1.5 text-[10px]"
        >
          <Key size={12} /> API Key
        </button>
      </div>

      {/* API Key Config */}
      {showConfig && (
        <div className="card-glow p-4 fade-up">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-2">OpenRouter API key (openrouter.ai/keys)</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="input-glow flex-1 px-3 py-2 text-xs"
            />
            <button
              onClick={() => { localStorage.setItem('fittrack_openrouter_key', apiKey); setShowConfig(false) }}
              className="btn-primary px-4 text-xs flex items-center gap-1"
            >
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      )}

      {/* Today's calories */}
      <div className="card-glow p-4 flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">Today's calories</span>
        <span className="text-xl font-bold text-glow-warn">{todayCalories} kcal</span>
      </div>

      {/* Photo capture */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="full-glow-card p-5 flex flex-col items-center gap-2.5"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,200,232,0.12), rgba(0,200,232,0.04))', border: '1px solid rgba(0,200,232,0.2)' }}>
            <Camera size={20} className="text-[var(--color-cyan)]" />
          </div>
          <span className="text-xs text-[var(--color-text-secondary)]">Take Photo</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="full-glow-card p-5 flex flex-col items-center gap-2.5"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,255,136,0.04))', border: '1px solid rgba(0,255,136,0.2)' }}>
            <Upload size={20} className="text-[var(--color-accent)]" />
          </div>
          <span className="text-xs text-[var(--color-text-secondary)]">Upload</span>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </div>

      {/* Photo preview + analyze */}
      {photo && (
        <div className="relative fade-up">
          <div className="camera-frame">
            <img src={photo} alt="Food" className="w-full max-h-48 object-cover" style={{ borderRadius: '15px' }} />
          </div>
          <button onClick={() => { setPhoto(null); setAnalysis(null) }} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(10,10,15,0.7)', border: '1px solid rgba(255,71,87,0.3)' }}>
            <X size={14} className="text-[var(--color-danger)]" />
          </button>
          {!analysis && (
            <button
              onClick={analyze}
              disabled={analyzing}
              className="mt-3 w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Zap size={14} className="animate-pulse" />
                  <span className="loading-shimmer px-2 rounded">Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Zap size={14} /> Analyze Food
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card-glow p-3 fade-up" style={{ borderColor: 'rgba(255,71,87,0.3)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-[var(--color-danger)] mt-0.5 flex-shrink-0" />
            <span className="text-xs text-[var(--color-danger)]">{error}</span>
          </div>
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="space-y-3 fade-up">
          {/* Macros */}
          <div className="card-glow p-4">
            <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-3">Nutritional Breakdown</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Calories', val: `${analysis.totalCalories}`, unit: 'kcal', cls: 'text-glow-warn' },
                { label: 'Protein', val: `${analysis.totalProtein}g`, unit: '', cls: 'text-glow-danger' },
                { label: 'Carbs', val: `${analysis.totalCarbs}g`, unit: '', cls: 'text-glow-cyan' },
                { label: 'Fat', val: `${analysis.totalFat}g`, unit: '', cls: 'text-[var(--color-warn)]' },
              ].map(m => (
                <div key={m.label}>
                  <div className={`text-lg font-bold ${m.cls}`}>{m.val}</div>
                  <div className="text-[9px] text-[var(--color-text-muted)]">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Foods detected */}
          <div className="card-glow p-4">
            <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2">Foods Detected</h3>
            {analysis.foods.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'rgba(58,58,68,0.4)' }}>
                <div className="flex items-center gap-2">
                  <span className={f.good ? 'text-glow-green' : 'text-glow-danger'}>{f.good ? '+' : '!'}</span>
                  <span className="text-sm text-[var(--color-text-primary)]">{f.name}</span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{f.calories} kcal</span>
              </div>
            ))}
          </div>

          {/* Eat / Avoid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card-glow p-3" style={{ borderColor: 'rgba(0,255,136,0.2)' }}>
              <h4 className="text-[10px] font-semibold text-glow-green mb-1.5">Eat This</h4>
              {analysis.eatThis.map((item, i) => (
                <p key={i} className="text-[11px] text-[var(--color-text-secondary)] py-0.5 flex items-start gap-1">
                  <span className="text-[var(--color-accent)] mt-px">+</span> {item}
                </p>
              ))}
            </div>
            <div className="card-glow p-3" style={{ borderColor: 'rgba(255,71,87,0.2)' }}>
              <h4 className="text-[10px] font-semibold text-glow-danger mb-1.5">Avoid</h4>
              {analysis.avoidThis.map((item, i) => (
                <p key={i} className="text-[11px] text-[var(--color-text-secondary)] py-0.5 flex items-start gap-1">
                  <span className="text-[var(--color-danger)] mt-px">-</span> {item}
                </p>
              ))}
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="card-glow p-4">
            <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2">AI Recommendation</h3>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{analysis.recommendation}</p>
          </div>
        </div>
      )}

      {/* Recent logs */}
      {logs.length > 0 && !analysis && (
        <div className="card-glow p-4">
          <h3 className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase mb-2">Recent Meals</h3>
          {logs.map(log => (
            <div key={log.id} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: 'rgba(58,58,68,0.4)' }}>
              <span className="text-[var(--color-text-muted)]">{log.date}</span>
              <span className="text-glow-warn font-semibold">{log.calories} kcal</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">P:{log.protein}g C:{log.carbs}g F:{log.fat}g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
