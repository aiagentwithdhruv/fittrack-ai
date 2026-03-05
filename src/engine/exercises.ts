export interface ExerciseDefinition {
  id: string
  name: string
  icon: string
  // Which landmarks to use for angle calculation
  joints: {
    left: [number, number, number]   // [shoulder, elbow, wrist] indices
    right: [number, number, number]
  }
  downAngle: number
  upAngle: number
  caloriesPerRep: number  // approximate
}

export const EXERCISES: ExerciseDefinition[] = [
  {
    id: 'pushup',
    name: 'Push-ups',
    icon: '💪',
    joints: { left: [11, 13, 15], right: [12, 14, 16] },
    downAngle: 90,
    upAngle: 155,
    caloriesPerRep: 0.36,
  },
  {
    id: 'squat',
    name: 'Squats',
    icon: '🦵',
    joints: { left: [23, 25, 27], right: [24, 26, 28] },
    downAngle: 90,
    upAngle: 160,
    caloriesPerRep: 0.32,
  },
  {
    id: 'situp',
    name: 'Sit-ups',
    icon: '🔥',
    joints: { left: [11, 23, 25], right: [12, 24, 26] },
    downAngle: 70,
    upAngle: 140,
    caloriesPerRep: 0.25,
  },
]

export function getExercise(id: string): ExerciseDefinition {
  return EXERCISES.find(e => e.id === id) ?? EXERCISES[0]
}
