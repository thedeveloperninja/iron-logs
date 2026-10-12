import { useState } from "react";
import type { Settings } from "@/api/types";
import { toInt, toNum } from "@/lib/format";

type Vals = Record<keyof Omit<Settings, "onboarded">, string>;
const toVals = (s: Settings | undefined): Vals => ({
  startDate: s?.startDate ?? "", endDate: s?.endDate ?? "",
  startWeightKg: s?.startWeightKg?.toString() ?? "", goalWeightKg: s?.goalWeightKg?.toString() ?? "",
  calorieTarget: s?.calorieTarget?.toString() ?? "", proteinTargetG: s?.proteinTargetG?.toString() ?? "",
  stepTarget: s?.stepTarget?.toString() ?? "", cardioTargetMin: s?.cardioTargetMin?.toString() ?? "",
});
export const fromVals = (v: Vals, onboarded: boolean): Settings => ({
  startDate: v.startDate || null, endDate: v.endDate || null,
  startWeightKg: toNum(v.startWeightKg), goalWeightKg: toNum(v.goalWeightKg),
  calorieTarget: toInt(v.calorieTarget), proteinTargetG: toInt(v.proteinTargetG),
  stepTarget: toInt(v.stepTarget), cardioTargetMin: toInt(v.cardioTargetMin), onboarded,
});

export function useGoals(initial: Settings | undefined, defaults?: Partial<Vals>) {
  const [vals, setVals] = useState<Vals>(() => ({ ...toVals(initial), ...Object.fromEntries(Object.entries(defaults ?? {}).filter(([k]) => !toVals(initial)[k as keyof Vals])) }));
  return { vals, set: (k: keyof Vals, v: string) => setVals((x) => ({ ...x, [k]: v })) };
}

export function GoalsFields({ g }: { g: ReturnType<typeof useGoals> }) {
  const F = (k: keyof Vals, label: string, type: "date" | "num", ph = "") => (
    <label className="field"><span className="label">{label}</span>
      <input type={type === "date" ? "date" : "text"} inputMode={type === "num" ? "decimal" : undefined} value={g.vals[k]}
        placeholder={ph} onChange={(e) => g.set(k, e.target.value)} /></label>
  );
  return (
    <div className="grid2">
      {F("startDate", "Plan start", "date")}
      {F("endDate", "Plan end", "date")}
      {F("startWeightKg", "Start weight (kg)", "num", "e.g. 100")}
      {F("goalWeightKg", "Goal weight (kg)", "num", "e.g. 85")}
      {F("calorieTarget", "Calories / day", "num", "e.g. 1900")}
      {F("proteinTargetG", "Protein (g / day)", "num", "e.g. 180")}
      {F("stepTarget", "Steps / day", "num", "e.g. 10000")}
      {F("cardioTargetMin", "Cardio (min / session)", "num", "e.g. 30")}
    </div>
  );
}
