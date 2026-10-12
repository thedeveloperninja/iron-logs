from tests.conftest import invite_user, make_client


def test_health_and_config(client):
    assert client.get("/api/health").json()["ok"] is True
    cfg = client.get("/api/v1/config").json()
    assert cfg["firstUser"] is True and cfg["signup"] == "open"


def test_first_user_is_admin_then_invite_only(admin, app):
    assert admin.get("/api/v1/config").json()["signup"] == "invite"
    c = make_client(app)
    r = c.post("/api/v1/auth/register", json={"username": "bob", "password": "password123"})
    assert r.status_code == 403
    bob = invite_user(admin, app, "bob")
    me = bob.get("/api/v1/me").json()
    assert me["username"] == "bob" and me["isAdmin"] is False


def test_invite_single_use(admin, app):
    code = admin.post("/api/v1/admin/invites", json={}).json()["code"]
    c1, c2 = make_client(app), make_client(app)
    assert c1.post("/api/v1/auth/register", json={"username": "amy1", "password": "password123",
                                                   "invite": code}).status_code == 201
    assert c2.post("/api/v1/auth/register", json={"username": "amy2", "password": "password123",
                                                   "invite": code}).status_code == 403


def test_login_logout_and_bad_password(admin, app):
    c = make_client(app)
    assert c.post("/api/v1/auth/login", json={"username": "ADMIN", "password": "nope"}).status_code == 401
    assert c.post("/api/v1/auth/login", json={"username": "ADMIN", "password": "password123"}).status_code == 200
    assert c.get("/api/v1/me").status_code == 200
    c.post("/api/v1/auth/logout")
    assert c.get("/api/v1/me").status_code == 401


def test_duplicate_username_case_insensitive(admin, app):
    admin.put("/api/v1/admin/signup", json={"mode": "open"})
    c = make_client(app)
    assert c.post("/api/v1/auth/register", json={"username": "Admin", "password": "password123"}).status_code == 409


def test_csrf_header_required(admin):
    r = admin.post("/api/v1/auth/logout", headers={"X-Requested-With": ""})
    assert r.status_code == 403


def test_rate_limit_login(admin, app):
    c = make_client(app)
    for _ in range(10):
        c.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert c.post("/api/v1/auth/login", json={"username": "admin", "password": "password123"}).status_code == 429


def test_change_password_signs_out_other_sessions(admin, app):
    other = make_client(app)
    other.post("/api/v1/auth/login", json={"username": "admin", "password": "password123"})
    r = admin.post("/api/v1/auth/password", json={"current": "password123", "new": "newpassword1"})
    assert r.status_code == 200
    assert admin.get("/api/v1/me").status_code == 200
    assert other.get("/api/v1/me").status_code == 401


def test_settings_roundtrip(admin):
    body = {"startDate": "2026-10-01", "endDate": "2026-12-31", "startWeightKg": 100, "goalWeightKg": 85,
            "calorieTarget": 1900, "proteinTargetG": 180, "stepTarget": 10000, "cardioTargetMin": 30,
            "onboarded": True}
    assert admin.put("/api/v1/me/settings", json=body).status_code == 200
    got = admin.get("/api/v1/me/settings").json()
    assert got["goalWeightKg"] == 85 and got["onboarded"] is True


def test_delete_account(admin, app):
    bob = invite_user(admin, app, "bob")
    assert bob.post("/api/v1/auth/delete-account", json={"password": "wrong"}).status_code == 400
    assert bob.post("/api/v1/auth/delete-account", json={"password": "password123"}).status_code == 200
    assert bob.get("/api/v1/me").status_code == 401
