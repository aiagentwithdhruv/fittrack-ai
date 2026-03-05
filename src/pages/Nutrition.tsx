import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, Utensils, X } from 'lucide-react'
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
    // Re-read key from localStorage in case it was saved after mount
    const key = apiKey || localStorage.getItem('fittrack_openrouter_key') || ''
    if (!key) { setShowConfig(true); return }

    setAnalyzing(true)
    setError(null)
    try {
      const imageDataUrl = photo

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
                { type: 'image_url', image_url: { url: imageDataUrl } },
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

      // Save to DB
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Utensils size={20} /> Nutrition
        </h1>
        <button onClick={() => setShowConfig(!showConfig)} className="text-xs text-[var(--color-dim)] border border-[var(--color-border)] rounded px-2 py-1">
          API Key
        </button>
      </div>

      {showConfig && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3">
          <p className="text-xs text-[var(--color-dim)] mb-2">OpenRouter API key (openrouter.ai/keys)</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={() => { localStorage.setItem('fittrack_openrouter_key', apiKey); setShowConfig(false) }}
              className="bg-[var(--color-accent)] text-black px-3 rounded text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Today's summary */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 flex items-center justify-between">
        <span className="text-xs text-[var(--color-dim)]">Today's calories</span>
        <span className="text-lg font-bold text-[var(--color-warn)]">{todayCalories} kcal</span>
      </div>

      {/* Photo capture */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center gap-2"
        >
          <Camera size={24} className="text-[var(--color-accent)]" />
          <span className="text-xs">Take Photo</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center gap-2"
        >
          <Upload size={24} className="text-[var(--color-accent)]" />
          <span className="text-xs">Upload</span>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImage} className="hidden" />
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </div>

      {/* Photo preview + analyze */}
      {photo && (
        <div className="relative">
          <img src={photo} alt="Food" className="w-full rounded-xl max-h-48 object-cover" />
          <button onClick={() => { setPhoto(null); setAnalysis(null) }} className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
            <X size={16} />
          </button>
          {!analysis && (
            <button
              onClick={analyze}
              disabled={analyzing}
              className="mt-2 w-full bg-[var(--color-accent)] text-black font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing with AI...' : 'Analyze Food'}
            </button>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="space-y-3">
          {/* Macros */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <h3 className="text-xs text-[var(--color-dim)] uppercase mb-3">Nutritional Breakdown</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Calories', val: `${analysis.totalCalories}`, unit: 'kcal', color: 'text-[var(--color-warn)]' },
                { label: 'Protein', val: `${analysis.totalProtein}g`, unit: '', color: 'text-red-400' },
                { label: 'Carbs', val: `${analysis.totalCarbs}g`, unit: '', color: 'text-blue-400' },
                { label: 'Fat', val: `${analysis.totalFat}g`, unit: '', color: 'text-yellow-400' },
              ].map(m => (
                <div key={m.label}>
                  <div className={`text-lg font-bold ${m.color}`}>{m.val}</div>
                  <div className="text-[0.55rem] text-[var(--color-dim)]">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Foods detected */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2">Foods Detected</h3>
            {analysis.foods.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2">
                  <span className={f.good ? 'text-green-400' : 'text-red-400'}>{f.good ? '✅' : '⚠️'}</span>
                  <span className="text-sm">{f.name}</span>
                </div>
                <span className="text-xs text-[var(--color-dim)]">{f.calories} kcal</span>
              </div>
            ))}
          </div>

          {/* Eat / Avoid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-card)] border border-green-900 rounded-xl p-3">
              <h4 className="text-xs text-green-400 font-semibold mb-1">✅ Eat This</h4>
              {analysis.eatThis.map((item, i) => (
                <p key={i} className="text-xs text-[var(--color-dim)] py-0.5">• {item}</p>
              ))}
            </div>
            <div className="bg-[var(--color-card)] border border-red-900 rounded-xl p-3">
              <h4 className="text-xs text-red-400 font-semibold mb-1">❌ Avoid</h4>
              {analysis.avoidThis.map((item, i) => (
                <p key={i} className="text-xs text-[var(--color-dim)] py-0.5">• {item}</p>
              ))}
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2">AI Recommendation</h3>
            <p className="text-sm leading-relaxed">{analysis.recommendation}</p>
          </div>
        </div>
      )}

      {/* Recent logs */}
      {logs.length > 0 && !analysis && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="text-xs text-[var(--color-dim)] uppercase mb-2">Recent Meals</h3>
          {logs.map(log => (
            <div key={log.id} className="flex justify-between py-1.5 border-b border-[var(--color-border)] last:border-0 text-sm">
              <span className="text-[var(--color-dim)]">{log.date}</span>
              <span className="text-[var(--color-warn)]">{log.calories} kcal</span>
              <span className="text-xs text-[var(--color-dim)]">P:{log.protein}g C:{log.carbs}g F:{log.fat}g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
