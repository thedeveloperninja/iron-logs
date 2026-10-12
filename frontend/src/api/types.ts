// Mirrors backend/app/schemas (camelCase JSON).
export type Color = "push" | "pull" | "legs" | "other";
export type Kind = "weight" | "reps" | "time" | "assist";
export type SignupMode = "open" | "invite" | "closed";

export interface AppConfig { version: string; signup: SignupMode; firstUser: boolean; exerciseImageBase: string; }
export interface User { id: number; username: string; isAdmin: boolean; }

export interface Settings {
  startDate: string | null; endDate: string | null;
  startWeightKg: number | null; goalWeightKg: number | null;
  calorieTarget: number | null; proteinTargetG: number | null;
  stepTarget: number | null; cardioTargetMin: number | null;
  onboarded: boolean;
}

export interface ExerciseRef { id: number; slug: string; name: string; kind: Kind; }
export interface Exercise extends ExerciseRef {
  equipment: string | null; category: string | null; level: string | null; mechanic: string | null;
  primaryMuscles: string[]; secondaryMuscles: string[]; instructions: string[]; images: string[]; custom: boolean;
}

export interface RoutineExercise { id: number; exercise: ExerciseRef; altExercise: ExerciseRef | null; sets: number; reps: string; restSeconds: number; }
export interface Routine { id: number; name: string; focus: string; color: Color; position: number; exercises: RoutineExercise[]; }
export interface RoutineExerciseIn { exerciseId: number; altExerciseId: number | null; sets: number; reps: string; restSeconds: number; }
export interface RoutineIn { name: string; focus: string; color: Color; exercises: RoutineExerciseIn[]; }
export interface Template { key: string; name: string; description: string; daysPerWeek: number; }

export interface SetIO { weightKg: number | null; reps: number | null; rir: number | null; done: boolean; }
export interface WorkoutExercise { id?: number; exercise: ExerciseRef; swapExercise: ExerciseRef | null; targetReps: string; restSeconds: number; note: string | null; sets: SetIO[]; }
export interface Workout { id?: number; date: string; routineId: number | null; name: string; color: Color; notes: string | null; startedAt: string | null; finishedAt: string | null; exercises: WorkoutExercise[]; }
export interface WorkoutSummary { date: string; name: string; color: Color; setsDone: number; setsTotal: number; volumeKg: number; prCount: number; finished: boolean; }
export interface ExerciseContext { exerciseId: number; previous: { date: string; sets: SetIO[] } | null; bestE1rm: number | null; }
export interface HistoryPoint { date: string; sets: SetIO[]; topKg: number | null; volumeKg: number; e1rm: number | null; }

export interface BodyLog {
  date: string; weightKg: number | null; calories: number | null; proteinG: number | null; steps: number | null;
  cardioMin: number | null; sleepH: number | null; waistCm: number | null; bodyFatPct: number | null; note: string | null;
}

export interface AdminUser { id: number; username: string; isAdmin: boolean; createdAt: string; lastSeenAt: string | null; workouts: number; }
export interface Invite { code: string; note: string | null; createdAt: string; expiresAt: string; usedBy: string | null; }
export interface AdminOverview { signup: SignupMode; users: AdminUser[]; invites: Invite[]; }
export interface ImportResult { mode: "merge" | "replace"; workouts: number; bodyLogs: number; routines: number; customExercises: number; skipped: string[]; }
