const SMOOTH_FRAMES = 3
const COOLDOWN_MS = 350

export type Stage = 'IDLE' | 'UP' | 'DOWN'

export interface RepState {
  count: number
  stage: Stage
  angle: number
  lastCountTime: number
  angleBuffer: number[]
}

export function resetRepState(): RepState {
  return { count: 0, stage: 'IDLE', angle: 0, lastCountTime: 0, angleBuffer: [] }
}

export function calcAngle(a: [number, number], b: [number, number], c: [number, number]): number {
  const ba = [a[0] - b[0], a[1] - b[1]]
  const bc = [c[0] - b[0], c[1] - b[1]]
  const dot = ba[0] * bc[0] + ba[1] * bc[1]
  const mag = Math.sqrt(ba[0] ** 2 + ba[1] ** 2) * Math.sqrt(bc[0] ** 2 + bc[1] ** 2) + 1e-6
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI)
}

function smoothAngle(raw: number, buffer: number[]): number {
  buffer.push(raw)
  if (buffer.length > SMOOTH_FRAMES) buffer.shift()
  return buffer.reduce((a, b) => a + b, 0) / buffer.length
}

export function processFrame(
  rawAngle: number,
  state: RepState,
  downAngle = 90,
  upAngle = 155,
): { state: RepState; repped: boolean } {
  const buf = [...state.angleBuffer]
  const smoothed = smoothAngle(rawAngle, buf)
  const now = Date.now()
  let repped = false
  let newStage = state.stage

  // Simple threshold-based stage detection
  if (smoothed <= downAngle) {
    newStage = 'DOWN'
  } else if (smoothed >= upAngle) {
    newStage = 'UP'
  }

  // Count: DOWN → UP = 1 rep
  if (state.stage === 'DOWN' && newStage === 'UP' && (now - state.lastCountTime) > COOLDOWN_MS) {
    repped = true
    return {
      state: { count: state.count + 1, stage: 'UP', angle: smoothed, lastCountTime: now, angleBuffer: buf },
      repped,
    }
  }

  // IDLE → first movement starts tracking
  if (state.stage === 'IDLE' && (newStage === 'DOWN' || newStage === 'UP')) {
    return {
      state: { ...state, stage: newStage, angle: smoothed, angleBuffer: buf },
      repped: false,
    }
  }

  return {
    state: { ...state, stage: newStage, angle: smoothed, angleBuffer: buf },
    repped,
  }
}

// Skeleton drawing
const SKELETON_PAIRS = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
]

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  w: number, h: number
) {
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(200,66,245,0.7)'
  for (const [s, e] of SKELETON_PAIRS) {
    if (s < landmarks.length && e < landmarks.length) {
      ctx.beginPath()
      ctx.moveTo(landmarks[s].x * w, landmarks[s].y * h)
      ctx.lineTo(landmarks[e].x * w, landmarks[e].y * h)
      ctx.stroke()
    }
  }
  for (const p of landmarks) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#f57542'
    ctx.fill()
  }
}

export function getAngleColor(angle: number, downAngle = 90, upAngle = 155): string {
  if (angle <= downAngle) return '#ff4757'
  if (angle >= upAngle) return '#00ff88'
  return '#ffd93d'
}

export function getRepProgress(angle: number, downAngle = 90, upAngle = 155): number {
  return Math.max(0, Math.min(100, ((upAngle - angle) / (upAngle - downAngle)) * 100))
}
