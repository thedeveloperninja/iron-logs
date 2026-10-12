from tests.conftest import invite_user, lib_id


def _seed(c):
    c.post("/api/v1/templates/ppl6/apply?replace=true")
    bench = lib_id(c, "Barbell_Bench_Press_-_Medium_Grip")
    custom = c.post("/api/v1/exercises", json={"name": "Landmine Press", "kind": "weight"}).json()
    rid = c.get("/api/v1/routines").json()[0]["id"]
    c.put("/api/v1/workouts/2026-10-05", json={"routineId": rid, "name": "Push A", "color": "push", "exercises": [
        {"exerciseId": bench, "sets": [{"weightKg": 60, "reps": 8, "done": True}]},
        {"exerciseId": custom["id"], "sets": [{"weightKg": 20, "reps": 10, "done": True}]}]})
    c.put("/api/v1/body/2026-10-05", json={"weightKg": 99.2})
    c.put("/api/v1/me/settings", json={"goalWeightKg": 85, "onboarded": True})


def test_export_import_roundtrip_to_other_user(admin, app):
    _seed(admin)
    r = admin.get("/api/v1/export")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["app"] == "iron-log" and data["version"] == 1
    assert len(data["routines"]) == 6 and data["schedule"][6] is None
    assert data["workouts"][0]["exercises"][1]["exercise"] == "custom:Landmine Press"

    bob = invite_user(admin, app, "bob")
    res = bob.post("/api/v1/import?mode=replace", json=data).json()
    assert res["workouts"] == 1 and res["routines"] == 6 and res["skipped"] == []
    w = bob.get("/api/v1/workouts/2026-10-05").json()
    assert [e["exercise"]["name"] for e in w["exercises"]] == ["Barbell Bench Press - Medium Grip", "Landmine Press"]
    assert w["routineId"] is not None
    assert bob.get("/api/v1/me/settings").json()["goalWeightKg"] == 85
    assert bob.get("/api/v1/body").json()[0]["weightKg"] == 99.2
    # merge import again does not duplicate custom exercises or workouts
    bob.post("/api/v1/import?mode=merge", json=data)
    names = [e["name"] for e in bob.get("/api/v1/exercises").json() if e["custom"]]
    assert names == ["Landmine Press"]
    assert len(bob.get("/api/v1/workouts").json()) == 1


def test_import_rejects_foreign_file(admin):
    assert admin.post("/api/v1/import", json={"app": "something-else"}).status_code == 422


def test_admin_endpoints(admin, app):
    bob = invite_user(admin, app, "bob")
    assert bob.get("/api/v1/admin").status_code == 403
    ov = admin.get("/api/v1/admin").json()
    assert [u["username"] for u in ov["users"]] == ["admin", "bob"]
    assert ov["invites"][0]["usedBy"] == "bob"
    bob_id = ov["users"][1]["id"]

    temp = admin.post(f"/api/v1/admin/users/{bob_id}/reset-password").json()["tempPassword"]
    assert bob.get("/api/v1/me").status_code == 401
    assert bob.post("/api/v1/auth/login", json={"username": "bob", "password": temp}).status_code == 200

    assert admin.put(f"/api/v1/admin/users/{bob_id}/admin", json={"isAdmin": True}).status_code == 200
    assert bob.get("/api/v1/admin").status_code == 200

    assert admin.put("/api/v1/admin/signup", json={"mode": "closed"}).status_code == 200
    assert admin.get("/api/v1/config").json()["signup"] == "closed"

    me_id = ov["users"][0]["id"]
    assert admin.delete(f"/api/v1/admin/users/{me_id}").status_code == 400
    assert admin.delete(f"/api/v1/admin/users/{bob_id}").status_code == 200
    assert len(admin.get("/api/v1/admin").json()["users"]) == 1
