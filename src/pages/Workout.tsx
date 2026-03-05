import { useRef, useState, useCallback, useEffect } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { calcAngle, processFrame, resetRepState, drawSkeleton, getAngleColor, getRepProgress, type RepState } from '../engine/rep-counter'
import { calculateXP, calculateStreak } from '../engine/gamification'
import { db, setStat, getStat } from '../db'
import { EXERCISES, type ExerciseDefinition } from '../engine/exercises'
import { Play, Pause, RotateCcw, Save, ChevronDown, Flame, Zap } from 'lucide-react'

export default function Workout() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const animRef = useRef<number>(0)
  const tsRef = useRef(0)

  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [repState, setRepState] = useState<RepState>(resetRepState())
  const [setNum, setSetNum] = useState(1)
  const [feedback, setFeedback] = useState('Select exercise & tap Start')
  const [exercise, setExercise] = useState<ExerciseDefinition>(EXERCISES[0])
  const [showPicker, setShowPicker] = useState(false)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [todayReps, setTodayReps] = useState(0)
  const [streak, setStreak] = useState(0)
  const [repTarget, setRepTarget] = useState(100)

  useEffect(() => {
    if (!running || !sessionStart) return
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [running, sessionStart])

  useEffect(() => {
    const stored = localStorage.getItem('fittrack_targets')
    if (stored) setRepTarget(JSON.parse(stored).reps || 100)
    const load = async () => {
      const today = new Date().toISOString().split('T')[0]
      const workouts = await db.workouts.where('date').equals(today).toArray()
      setTodayReps(workouts.reduce((s, w) => s + w.reps, 0))
      const allDates = (await db.workouts.toArray()).map(w => w.date)
      setStreak(calculateStreak(allDates).current)
    }
    load()
  }, [])

  const initModel = async () => {
    if (landmarkerRef.current) return
    setLoading(true)
    setFeedback('Loading AI model...')
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    )
    landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    })
    setLoading(false)
  }

  const detect = useCallback(() => {
    if (!running) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker) return

    const now = performance.now()
    if (now === tsRef.current) { animRef.current = requestAnimationFrame(detect); return }
    tsRef.current = now

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const result = landmarker.detectForVideo(video, Math.round(now))

    if (result.landmarks?.[0]) {
      const lm = result.landmarks[0]
      drawSkeleton(ctx, lm, w, h)

      const c = (i: number): [number, number] => [lm[i].x * w, lm[i].y * h]
      const { left, right } = exercise.joints
      const lAngle = calcAngle(c(left[0]), c(left[1]), c(left[2]))
      const rAngle = calcAngle(c(right[0]), c(right[1]), c(right[2]))
      const avg = (lAngle + rAngle) / 2

      const color = getAngleColor(avg, exercise.downAngle, exercise.upAngle)
      for (const idx of [left[1], right[1]]) {
        const x = lm[idx].x * w, y = lm[idx].y * h
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill()
        ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#fff'
        ctx.fillText(`${Math.round(avg)}°`, x + 12, y - 6)
      }

      setRepState(prev => {
        const { state: next, repped } = processFrame(avg, prev, exercise.downAngle, exercise.upAngle)
        if (repped) {
          setFeedback(`Rep ${next.count}!`)
          setTodayReps(t => t + 1)
        } else if (next.stage === 'DOWN') {
          setFeedback('Good depth! Push up!')
        } else if (next.stage === 'UP') {
          setFeedback('Go down — lower your body')
        }
        return next
      })
    } else {
      setFeedback('No pose detected — show full body')
    }

    animRef.current = requestAnimationFrame(detect)
  }, [running, exercise])

  useEffect(() => {
    if (running) {
      animRef.current = requestAnimationFrame(detect)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [running, detect])

  const start = async () => {
    await initModel()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    })
    videoRef.current!.srcObject = stream
    await new Promise<void>(r => { videoRef.current!.onloadeddata = () => r() })
    setRunning(true)
    if (!sessionStart) setSessionStart(Date.now())
    setFeedback(`${exercise.name} — let's go!`)
  }

  const pause = () => {
    setRunning(false)
    const video = videoRef.current
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    setFeedback('Paused')
  }

  const reset = () => {
    setRepState(resetRepState())
    setSessionStart(running ? Date.now() : null)
    setElapsed(0)
    setFeedback('Counter reset')
  }

  const saveSet = async () => {
    if (repState.count === 0) return
    const xp = calculateXP(repState.count, streak)
    const today = new Date().toISOString().split('T')[0]
    await db.workouts.add({
      date: today,
      exercise: exercise.id,
      reps: repState.count,
      sets: setNum,
      duration: elapsed,
      avgSpeed: null,
      xpEarned: xp,
      createdAt: new Date().toISOString(),
    })
    const totalXP = parseInt(await getStat('totalXP', '0')) + xp
    await setStat('totalXP', String(totalXP))
    setSetNum(s => s + 1)
    setRepState(resetRepState())
    setSessionStart(Date.now())
    setElapsed(0)
    setFeedback(`Set saved! +${xp} XP`)

    const allDates = (await db.workouts.toArray()).map(w => w.date)
    setStreak(calculateStreak(allDates).current)
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')
  const progress = getRepProgress(repState.angle, exercise.downAngle, exercise.upAngle)
  const targetPct = Math.min((todayReps / repTarget) * 100, 100)
  const targetHit = todayReps >= repTarget

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] p-3 gap-2.5">
      {/* Exercise picker */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="card-glow flex items-center gap-3 px-4 py-2.5 w-full"
        >
          <span className="text-xl">{exercise.icon}</span>
          <span className="font-semibold text-sm text-[var(--color-text-primary)]">{exercise.name}</span>
          <ChevronDown size={14} className="ml-auto text-[var(--color-cyan)]" style={{ filter: 'drop-shadow(0 0 4px rgba(0,200,232,0.4))' }} />
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1e24 0%, #141418 100%)', border: '1px solid rgba(0,200,232,0.2)', borderRadius: '12px' }}>
            {EXERCISES.map(ex => (
              <button
                key={ex.id}
                onClick={() => { setExercise(ex); setShowPicker(false); reset() }}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-all ${
                  ex.id === exercise.id
                    ? 'text-glow-cyan'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-cyan)] hover:bg-[rgba(0,200,232,0.05)]'
                }`}
              >
                <span className="text-lg">{ex.icon}</span>
                <span className="font-medium">{ex.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Camera View */}
      <div className="camera-frame relative flex-1 min-h-0">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ borderRadius: '15px' }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" style={{ borderRadius: '15px' }} />
        {!running && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(circle at center, rgba(0,200,232,0.03) 0%, rgba(10,10,15,0.85) 100%)', borderRadius: '15px' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 glow-breathe" style={{ background: 'linear-gradient(135deg, #1e1e24 0%, #141418 100%)', border: '1px solid rgba(0,200,232,0.3)' }}>
              <Play size={28} className="text-[var(--color-cyan)] ml-1" />
            </div>
            <p className="text-[var(--color-text-muted)] text-xs">Tap Start to begin</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(10,10,15,0.9)', borderRadius: '15px' }}>
            <div className="w-12 h-12 rounded-full glow-breathe flex items-center justify-center mb-2" style={{ border: '2px solid rgba(0,200,232,0.4)' }}>
              <Zap size={20} className="text-[var(--color-cyan)] animate-pulse" />
            </div>
            <p className="text-[var(--color-cyan)] text-xs loading-shimmer px-4 py-1 rounded-full">Loading AI model...</p>
          </div>
        )}
      </div>

      {/* Rep progress bar */}
      <div className="progress-track h-1.5">
        <div className="progress-fill h-full transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stat-card p-2.5 text-center">
          <div className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase">Reps</div>
          <div className="text-2xl font-bold text-glow-green mt-0.5">{repState.count}</div>
        </div>
        <div className="stat-card p-2.5 text-center">
          <div className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase">Set</div>
          <div className="text-2xl font-bold text-glow-cyan mt-0.5">{setNum}</div>
        </div>
        <div className="stat-card p-2.5 text-center">
          <div className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase">Time</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>{mins}:{secs}</div>
        </div>
      </div>

      {/* Daily target */}
      <div className="card-glow px-4 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-medium tracking-widest text-[var(--color-text-muted)] uppercase">Daily Target</span>
          <span className="text-xs font-bold">
            <span className={targetHit ? 'text-glow-green' : 'text-glow-warn'}>{todayReps}</span>
            <span className="text-[var(--color-text-muted)]"> / {repTarget}</span>
          </span>
        </div>
        <div className="progress-track h-1.5">
          <div
            className={`h-full transition-all duration-300 ${targetHit ? 'progress-accent' : 'progress-warn'}`}
            style={{ width: `${targetPct}%` }}
          />
        </div>
      </div>

      {/* Streak + Feedback */}
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <div className="stat-card px-3 py-2 flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" style={{ filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.5))' }} />
            <span className="text-xs font-bold text-orange-400">{streak}d</span>
          </div>
        )}
        <div className="flex-1 card-glow px-4 py-2 text-center">
          <span className="text-xs text-[var(--color-text-secondary)]">{feedback}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-4 gap-2">
        {!running ? (
          <button onClick={start} className="col-span-2 btn-primary py-3 flex items-center justify-center gap-2 text-sm">
            <Play size={16} /> Start
          </button>
        ) : (
          <button onClick={pause} className="col-span-2 py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-xl" style={{ background: 'linear-gradient(135deg, #ffd93d 0%, #ffb800 100%)', color: '#0a0a0f', boxShadow: '0 0 15px rgba(255,217,61,0.2)' }}>
            <Pause size={16} /> Pause
          </button>
        )}
        <button onClick={reset} className="btn-danger py-3 flex items-center justify-center gap-1.5 text-sm font-semibold">
          <RotateCcw size={14} />
        </button>
        <button onClick={saveSet} className="btn-ghost py-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--color-cyan)]">
          <Save size={14} />
        </button>
      </div>
    </div>
  )
}
