import { useRef, useState, useCallback, useEffect } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { calcAngle, processFrame, resetRepState, drawSkeleton, getAngleColor, getRepProgress, type RepState } from '../engine/rep-counter'
import { calculateXP, calculateStreak } from '../engine/gamification'
import { db, setStat, getStat } from '../db'
import { EXERCISES, type ExerciseDefinition } from '../engine/exercises'
import { Play, Pause, RotateCcw, ChevronDown } from 'lucide-react'

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

  // Timer
  useEffect(() => {
    if (!running || !sessionStart) return
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [running, sessionStart])

  // Load today's stats + targets
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

      // Draw angle on elbows/joints
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
          setFeedback(`Rep ${next.count}! 🔥`)
          setTodayReps(t => t + 1)
        } else if (next.stage === 'DOWN') {
          setFeedback('Good depth! Push up!')
        } else if (next.stage === 'UP') {
          setFeedback('Go down — lower your body')
        }
        return next
      })
    } else {
      setFeedback('No pose — show full body')
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
    setFeedback(`Set saved! +${xp} XP ⚡`)

    // Recalculate streak
    const allDates = (await db.workouts.toArray()).map(w => w.date)
    setStreak(calculateStreak(allDates).current)
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')
  const progress = getRepProgress(repState.angle, exercise.downAngle, exercise.upAngle)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 gap-2">
      {/* Exercise picker */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-full"
        >
          <span className="text-lg">{exercise.icon}</span>
          <span className="font-semibold">{exercise.name}</span>
          <ChevronDown size={14} className="ml-auto text-[var(--color-dim)]" />
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden z-10">
            {EXERCISES.map(ex => (
              <button
                key={ex.id}
                onClick={() => { setExercise(ex); setShowPicker(false); reset() }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[var(--color-border)] ${
                  ex.id === exercise.id ? 'text-[var(--color-accent)]' : ''
                }`}
              >
                <span>{ex.icon}</span> {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Camera */}
      <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
        {!running && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-[var(--color-dim)] text-sm">Tap Start to begin</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-[var(--color-accent)] text-sm animate-pulse">Loading AI model...</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-accent)] transition-all duration-100" style={{ width: `${progress}%` }} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Reps', value: repState.count, color: 'text-[var(--color-accent)]' },
          { label: 'Set', value: setNum, color: 'text-[var(--color-text)]' },
          { label: 'Time', value: `${mins}:${secs}`, color: 'text-[var(--color-text)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2 text-center">
            <div className="text-[0.55rem] text-[var(--color-dim)] uppercase tracking-wider">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Today's target progress */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[0.6rem] text-[var(--color-dim)] uppercase">Daily Target</span>
          <span className="text-xs font-bold">
            <span className={todayReps >= repTarget ? 'text-[var(--color-accent)]' : 'text-[var(--color-warn)]'}>{todayReps}</span>
            <span className="text-[var(--color-dim)]"> / {repTarget} reps</span>
          </span>
        </div>
        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min((todayReps / repTarget) * 100, 100)}%`,
              backgroundColor: todayReps >= repTarget ? 'var(--color-accent)' : 'var(--color-warn)',
            }}
          />
        </div>
      </div>

      {/* Streak + feedback */}
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs">
            🔥 {streak}d
          </div>
        )}
        <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-dim)] text-center">
          {feedback}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-4 gap-2">
        {!running ? (
          <button onClick={start} className="col-span-2 bg-[var(--color-accent)] text-black font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5">
            <Play size={16} /> Start
          </button>
        ) : (
          <button onClick={pause} className="col-span-2 bg-[var(--color-warn)] text-black font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5">
            <Pause size={16} /> Pause
          </button>
        )}
        <button onClick={reset} className="bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-danger)] rounded-lg py-2.5 flex items-center justify-center gap-1">
          <RotateCcw size={14} /> Reset
        </button>
        <button onClick={saveSet} className="bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-accent)] rounded-lg py-2.5 text-sm font-semibold">
          Save Set
        </button>
      </div>
    </div>
  )
}
