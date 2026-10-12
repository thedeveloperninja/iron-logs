"""Starter programs a new user can apply. Exercises are library slugs (free-exercise-db ids)."""
from __future__ import annotations

# (main, alternative, sets, reps, rest_seconds)
T = tuple[str, str | None, int, str, int]

TEMPLATES: dict[str, dict] = {
    "ppl6": {
        "name": "Push / Pull / Legs (6 days)",
        "description": "Each muscle twice a week. Mon–Sat, Sunday rest. Good for intermediate lifters and cuts.",
        "schedule": ["pushA", "pullA", "legsA", "pushB", "pullB", "legsB", None],
        "routines": {
            "pushA": ("Push A", "Chest · Shoulders · Triceps", "push", [
                ("Barbell_Bench_Press_-_Medium_Grip", "Machine_Bench_Press", 4, "6-8", 150),
                ("Incline_Dumbbell_Press", "Leverage_Incline_Chest_Press", 3, "8-10", 120),
                ("Seated_Dumbbell_Press", "Machine_Shoulder_Military_Press", 2, "8-10", 120),
                ("Side_Lateral_Raise", "Cable_Seated_Lateral_Raise", 4, "12-15", 75),
                ("Triceps_Pushdown", "Dips_-_Triceps_Version", 3, "10-12", 75)]),
            "pullA": ("Pull A", "Back · Biceps", "pull", [
                ("Wide-Grip_Lat_Pulldown", "Band_Assisted_Pull-Up", 4, "8-10", 120),
                ("Dumbbell_Incline_Row", "One-Arm_Dumbbell_Row", 3, "8-10", 120),
                ("Seated_Cable_Rows", "Bent_Over_Two-Dumbbell_Row", 3, "10-12", 90),
                ("Face_Pull", "Reverse_Flyes", 3, "12-15", 60),
                ("Dumbbell_Bicep_Curl", "EZ-Bar_Curl", 3, "10-12", 75)]),
            "legsA": ("Legs A", "Quads · Hamstrings · Glutes · Abs", "legs", [
                ("Barbell_Squat", "Goblet_Squat", 4, "6-8", 150),
                ("Leg_Press", "Split_Squats", 3, "10", 120),
                ("Romanian_Deadlift", "Barbell_Hip_Thrust", 3, "8-10", 120),
                ("Lying_Leg_Curls", "Ball_Leg_Curl", 3, "10-12", 90),
                ("Standing_Calf_Raises", "Seated_Calf_Raise", 4, "12-15", 60),
                ("Hanging_Leg_Raise", "Flat_Bench_Lying_Leg_Raise", 3, "10-15", 60)]),
            "pushB": ("Push B", "Upper chest · Delts · Triceps", "push", [
                ("Barbell_Incline_Bench_Press_-_Medium_Grip", "Leverage_Incline_Chest_Press", 4, "8", 150),
                ("Dumbbell_Bench_Press", "Machine_Bench_Press", 3, "10", 120),
                ("Cable_Crossover", "Butterfly", 3, "12", 75),
                ("Side_Lateral_Raise", "Cable_Seated_Lateral_Raise", 4, "15", 60),
                ("Cable_Rope_Overhead_Triceps_Extension", "Dips_-_Triceps_Version", 3, "12", 75)]),
            "pullB": ("Pull B", "Back width · Arms · Side delts", "pull", [
                ("Band_Assisted_Pull-Up", "Wide-Grip_Lat_Pulldown", 4, "6-10", 120),
                ("Bent_Over_Barbell_Row", "T-Bar_Row_with_Handle", 3, "8", 120),
                ("Seated_Cable_Rows", "Bent_Over_Two-Dumbbell_Row", 3, "12", 90),
                ("Face_Pull", "Reverse_Flyes", 3, "15", 60),
                ("Hammer_Curls", "Dumbbell_Bicep_Curl", 3, "12", 75),
                ("Side_Lateral_Raise", "Cable_Seated_Lateral_Raise", 3, "15", 60)]),
            "legsB": ("Legs B", "Lower body · Core", "legs", [
                ("Barbell_Squat", "Hack_Squat", 3, "8", 150),
                ("Lying_Leg_Curls", "Ball_Leg_Curl", 3, "12", 90),
                ("Barbell_Hip_Thrust", "Butt_Lift_Bridge", 3, "10", 120),
                ("Leg_Extensions", "Bodyweight_Walking_Lunge", 3, "12", 90),
                ("Standing_Calf_Raises", "Seated_Calf_Raise", 4, "15", 60),
                ("Cable_Crunch", "Crunches", 3, "12", 60),
                ("Plank", "Ab_Roller", 3, "45", 60)]),
        },
    },
    "ul4": {
        "name": "Upper / Lower (4 days)",
        "description": "Mon/Tue/Thu/Fri. Balanced strength and size with recovery days in between.",
        "schedule": ["upperA", "lowerA", None, "upperB", "lowerB", None, None],
        "routines": {
            "upperA": ("Upper A", "Strength focus", "push", [
                ("Barbell_Bench_Press_-_Medium_Grip", "Dumbbell_Bench_Press", 4, "5-8", 150),
                ("Bent_Over_Barbell_Row", "Seated_Cable_Rows", 4, "6-8", 150),
                ("Standing_Military_Press", "Seated_Dumbbell_Press", 3, "8-10", 120),
                ("Wide-Grip_Lat_Pulldown", "Pullups", 3, "8-10", 120),
                ("Triceps_Pushdown", "Lying_Triceps_Press", 3, "10-12", 75),
                ("Dumbbell_Bicep_Curl", "Hammer_Curls", 3, "10-12", 75)]),
            "lowerA": ("Lower A", "Squat focus", "legs", [
                ("Barbell_Squat", "Hack_Squat", 4, "5-8", 180),
                ("Romanian_Deadlift", "Stiff-Legged_Barbell_Deadlift", 3, "8-10", 150),
                ("Leg_Press", "Dumbbell_Lunges", 3, "10-12", 120),
                ("Lying_Leg_Curls", "Seated_Leg_Curl", 3, "10-12", 90),
                ("Standing_Calf_Raises", "Seated_Calf_Raise", 4, "12-15", 60)]),
            "upperB": ("Upper B", "Hypertrophy focus", "pull", [
                ("Incline_Dumbbell_Press", "Barbell_Incline_Bench_Press_-_Medium_Grip", 4, "8-10", 120),
                ("One-Arm_Dumbbell_Row", "T-Bar_Row_with_Handle", 3, "10-12", 90),
                ("Arnold_Dumbbell_Press", "Leverage_Shoulder_Press", 3, "10-12", 90),
                ("Side_Lateral_Raise", "Cable_Seated_Lateral_Raise", 4, "12-15", 60),
                ("Face_Pull", "Reverse_Flyes", 3, "15", 60),
                ("Preacher_Curl", "EZ-Bar_Curl", 3, "10-12", 60)]),
            "lowerB": ("Lower B", "Hinge focus", "legs", [
                ("Barbell_Deadlift", "Romanian_Deadlift", 3, "5", 180),
                ("Front_Barbell_Squat", "Goblet_Squat", 3, "8-10", 150),
                ("Barbell_Hip_Thrust", "Butt_Lift_Bridge", 3, "10", 120),
                ("Leg_Extensions", "Split_Squats", 3, "12-15", 75),
                ("Hanging_Leg_Raise", "Cable_Crunch", 3, "12-15", 60)]),
        },
    },
    "fb3": {
        "name": "Full Body (3 days)",
        "description": "Mon/Wed/Fri. Best for beginners or busy weeks.",
        "schedule": ["fullA", None, "fullB", None, "fullA", None, None],
        "routines": {
            "fullA": ("Full Body A", "Squat · Press · Row", "other", [
                ("Barbell_Squat", "Goblet_Squat", 3, "6-8", 150),
                ("Barbell_Bench_Press_-_Medium_Grip", "Pushups", 3, "6-8", 150),
                ("Bent_Over_Barbell_Row", "Seated_Cable_Rows", 3, "8-10", 120),
                ("Side_Lateral_Raise", None, 3, "12-15", 60),
                ("Plank", None, 3, "45", 60)]),
            "fullB": ("Full Body B", "Hinge · Press · Pull", "other", [
                ("Romanian_Deadlift", "Barbell_Hip_Thrust", 3, "8-10", 150),
                ("Standing_Military_Press", "Seated_Dumbbell_Press", 3, "8-10", 120),
                ("Wide-Grip_Lat_Pulldown", "Chin-Up", 3, "8-10", 120),
                ("Dumbbell_Lunges", "Split_Squats", 3, "10", 90),
                ("Hanging_Leg_Raise", "Crunches", 3, "12", 60)]),
        },
    },
}
