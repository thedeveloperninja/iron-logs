import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, get, put } from "./client";
import type {
  AppConfig, BodyLog, Exercise, ExerciseContext, HistoryPoint, Routine, Settings, Template, User, Workout, WorkoutSummary,
} from "./types";

export const qk = {
  config: ["config"] as const,
  me: ["me"] as const,
  settings: ["settings"] as const,
  exercises: ["exercises"] as const,
  routines: ["routines"] as const,
  schedule: ["schedule"] as const,
  templates: ["templates"] as const,
  workout: (d: string) => ["workout", d] as const,
  workouts: ["workouts"] as const,
  context: (d: string, ids: number[]) => ["context", d, ids.join(",")] as const,
  history: (id: number) => ["history", id] as const,
  body: ["body"] as const,
  admin: ["admin"] as const,
};

export const useConfig = () => useQuery({ queryKey: qk.config, queryFn: () => get<AppConfig>("/config"), staleTime: 60_000 });

export const useMe = () => useQuery({
  queryKey: qk.me,
  queryFn: async () => {
    try { return await get<User>("/me"); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
  },
  staleTime: 5 * 60_000,
});

export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: () => get<Settings>("/me/settings") });
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => put<Settings>("/me/settings", s),
    onSuccess: (s) => qc.setQueryData(qk.settings, s),
  });
}

export const useExercises = () => useQuery({ queryKey: qk.exercises, queryFn: () => get<Exercise[]>("/exercises"), staleTime: 10 * 60_000 });
export const useRoutines = () => useQuery({ queryKey: qk.routines, queryFn: () => get<Routine[]>("/routines") });
export const useSchedule = () => useQuery({ queryKey: qk.schedule, queryFn: async () => (await get<{ days: (number | null)[] }>("/schedule")).days });
export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: () => get<Template[]>("/templates"), staleTime: Infinity });

export const useWorkout = (date: string) => useQuery({
  queryKey: qk.workout(date),
  queryFn: async () => {
    try { return await get<Workout>(`/workouts/${date}`); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
  },
});
export const useWorkouts = () => useQuery({ queryKey: qk.workouts, queryFn: () => get<WorkoutSummary[]>("/workouts") });
export const useContext = (date: string, ids: number[]) => useQuery({
  queryKey: qk.context(date, ids),
  queryFn: () => get<ExerciseContext[]>(`/workouts/context?before=${date}&ids=${ids.join(",")}`),
  enabled: ids.length > 0,
  staleTime: 60_000,
});
export const useHistory = (id: number | null) => useQuery({
  queryKey: qk.history(id ?? 0), queryFn: () => get<HistoryPoint[]>(`/exercises/${id}/history`), enabled: !!id,
});
export const useBody = () => useQuery({ queryKey: qk.body, queryFn: () => get<BodyLog[]>("/body") });

/** Switch the signed-in user (or sign out with null) without detaching the app's `me` subscription. */
export function resetSession(qc: QueryClient, user: User | null) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "config" });
  qc.setQueryData<User | null>(qk.me, user);
  void qc.invalidateQueries({ queryKey: qk.config });
}
