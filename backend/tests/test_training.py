from tests.conftest import invite_user, lib_id


def test_library_seeded(admin):
    ex = admin.get("/api/v1/exercises").json()
    assert len(ex) >= 800
    bench = next(e for e in ex if e["slug"] == "Barbell_Bench_Press_-_Medium_Grip")
    assert bench["kind"] == "weight" and bench["instructions"] and len(bench["images"]) == 2


def test_apply_template_and_schedule(admin):
    tpls = admin.get("/api/v1/templates").json()
    assert {t["key"] for t in tpls} == {"ppl6", "ul4", "fb3"}
    routines = admin.post("/api/v1/templates/ppl6/apply?replace=true").json()
    assert [r["name"] for r in routines] == ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]
    sched = admin.get("/api/v1/schedule").json()["days"]
    assert sched[6] is None and sched[0] == routines[0]["id"]
    # applying again with replace doesn't duplicate
    admin.post("/api/v1/templates/ppl6/apply?replace=true")
    assert len(admin.get("/api/v1/routines").json()) == 6


def test_routine_crud_and_validation(admin):
    squat = lib_id(admin, "Barbell_Squat")
    r = admin.post("/api/v1/routines", json={"name": "Legs", "color": "legs",
                                              "exercises": [{"exerciseId": squat, "sets": 5, "reps": "5"}]})
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["exercises"][0]["exercise"]["slug"] == "Barbell_Squat"
    bad = admin.put(f"/api/v1/routines/{rid}", json={"name": "Legs", "exercises": [{"exerciseId": 999999}]})
    assert bad.status_code == 400
    assert admin.put("/api/v1/schedule", json={"days": [rid, None, None, None, None, None, None]}).status_code == 200
    assert admin.delete(f"/api/v1/routines/{rid}").status_code == 204
    assert admin.get("/api/v1/schedule").json()["days"][0] is None


def _workout(bench, sets):
    return {"name": "Push A", "color": "push", "exercises": [
        {"exerciseId": bench, "targetReps": "6-8", "restSeconds": 150,
         "sets": [{"weightKg": kg, "reps": r, "done": True} for kg, r in sets]}]}


def test_workout_upsert_context_and_prs(admin):
    bench = lib_id(admin, "Barbell_Bench_Press_-_Medium_Grip")
    assert admin.put("/api/v1/workouts/2026-10-05", json=_workout(bench, [(60, 8), (60, 7)])).status_code == 200
    assert admin.put("/api/v1/workouts/2026-10-08", json=_workout(bench, [(62.5, 8), (62.5, 6)])).status_code == 200
    # replace is idempotent (no duplicated children)
    w = admin.put("/api/v1/workouts/2026-10-08", json=_workout(bench, [(62.5, 8), (62.5, 6)])).json()
    assert len(w["exercises"]) == 1 and len(w["exercises"][0]["sets"]) == 2

    ctx = admin.get(f"/api/v1/workouts/context?before=2026-10-12&ids={bench}").json()[0]
    assert ctx["previous"]["date"] == "2026-10-08"
    assert [s["weightKg"] for s in ctx["previous"]["sets"]] == [62.5, 62.5]
    assert ctx["bestE1rm"] == round(62.5 * (1 + 8 / 30), 1)

    summ = {s["date"]: s for s in admin.get("/api/v1/workouts").json()}
    assert summ["2026-10-05"]["prCount"] == 0 and summ["2026-10-08"]["prCount"] == 1
    assert summ["2026-10-05"]["volumeKg"] == 60 * 8 + 60 * 7

    hist = admin.get(f"/api/v1/exercises/{bench}/history").json()
    assert [h["topKg"] for h in hist] == [60, 62.5]

    assert admin.delete("/api/v1/workouts/2026-10-05").status_code == 204
    assert admin.get("/api/v1/workouts/2026-10-05").status_code == 404


def test_users_are_isolated(admin, app):
    bench = lib_id(admin, "Barbell_Bench_Press_-_Medium_Grip")
    admin.put("/api/v1/workouts/2026-10-05", json=_workout(bench, [(60, 8)]))
    custom = admin.post("/api/v1/exercises", json={"name": "Secret Move", "kind": "reps"}).json()
    bob = invite_user(admin, app, "bob")
    assert bob.get("/api/v1/workouts/2026-10-05").status_code == 404
    assert bob.get("/api/v1/workouts").json() == []
    assert all(e["name"] != "Secret Move" for e in bob.get("/api/v1/exercises").json())
    r = bob.put("/api/v1/workouts/2026-10-06", json={"name": "x", "exercises": [{"exerciseId": custom["id"]}]})
    assert r.status_code == 400


def test_custom_exercise_archive_when_used(admin):
    ex = admin.post("/api/v1/exercises", json={"name": "Landmine Press", "kind": "weight",
                                                "primaryMuscles": ["Shoulders"]}).json()
    assert ex["custom"] is True and ex["primaryMuscles"] == ["shoulders"]
    admin.put("/api/v1/workouts/2026-10-05", json={"name": "x", "exercises": [{"exerciseId": ex["id"]}]})
    assert admin.delete(f"/api/v1/exercises/{ex['id']}").json()["result"] == "archived"
    other = admin.post("/api/v1/exercises", json={"name": "Unused", "kind": "reps"}).json()
    assert admin.delete(f"/api/v1/exercises/{other['id']}").json()["result"] == "deleted"


def test_body_logs(admin):
    assert admin.put("/api/v1/body/2026-10-01", json={"weightKg": 100, "calories": 1900}).status_code == 200
    admin.put("/api/v1/body/2026-10-02", json={"weightKg": 99.6, "steps": 11000})
    logs = admin.get("/api/v1/body?from=2026-10-01&to=2026-10-31").json()
    assert [log["weightKg"] for log in logs] == [100, 99.6]
    admin.put("/api/v1/body/2026-10-02", json={})  # all empty -> removed
    assert len(admin.get("/api/v1/body").json()) == 1
    assert admin.put("/api/v1/body/2026-10-03", json={"weightKg": -5}).status_code == 422
