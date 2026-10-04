"""Check of the login -> member linking rules on the real database (migrations 000023, 000024; ADR-0013).

Run after any change to handle_new_auth_user / link_auth_user / create_email_member / ensure_member_row
or to privileges on public.users. Creates throwaway logins/rows (emails at the mail provider's test
inbox), asserts the behaviour, and removes everything it created. Prints no secrets.

    cd 03-output/app
    SB_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-) \
    SB_SERVICE=$(grep '^SUPABASE_SECRET_KEY=' .env.local | cut -d= -f2-) \
    SB_PUBLIC=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2-) \
    python3 ../supabase/checks/verify_auth_linking.py

It cannot create a real Google identity: Google-shaped fixtures are password-less logins with Google
app metadata. A real Google sign-up against a pre-registered row still has to be tried by hand.
"""
import json, os, secrets, sys, time, urllib.error, urllib.parse, urllib.request

URL = os.environ["SB_URL"]; SERVICE = os.environ["SB_SERVICE"]; PUBLIC = os.environ["SB_PUBLIC"]
TS = int(time.time())
created_auth, created_rows, created_apps, results = [], [], [], []
GOOGLE_APP = {"provider": "google", "providers": ["google"]}
ROW_COLS = "id,auth_user_id,nickname,kakao_nickname,google_id,terms_agreed_at"


def call(method, path, key, body=None, prefer=None, bearer=None):
    headers = {"apikey": key, "authorization": "Bearer " + (bearer or key), "content-type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw)
        except Exception:
            return err.code, raw.decode()[:200]


def email(tag):
    return f"delivered+trg{tag}{TS}@resend.dev"


def enc(value):
    return urllib.parse.quote(value, safe="")


def member_by_email(addr):
    _, rows = call("GET", f"/rest/v1/users?email=eq.{enc(addr)}&select={ROW_COLS}", SERVICE)
    return rows[0] if rows else None


def member_by_login(uid):
    _, rows = call("GET", f"/rest/v1/users?auth_user_id=eq.{uid}&select={ROW_COLS}", SERVICE)
    return rows[0] if rows else None


def signup_link(addr, meta=None):
    """Pending email account + confirmation token (what our signup route and the public API both produce)."""
    body = {"type": "signup", "email": addr, "password": secrets.token_urlsafe(18)}
    if meta:
        body["data"] = meta
    status, d = call("POST", "/auth/v1/admin/generate_link", SERVICE, body)
    assert status == 200, (status, d)
    if d["id"] not in created_auth:
        created_auth.append(d["id"])
    return d["id"], d["hashed_token"]


def make_member(uid, nickname="trg-nick", kakao="trg-kakao"):
    return rpc("create_email_member", {"p_auth_user_id": uid, "p_nickname": nickname, "p_kakao_nickname": kakao}, SERVICE)


def rpc(name, args, key, bearer=None):
    return call("POST", f"/rest/v1/rpc/{name}", key, args, bearer=bearer)


def confirm(token_hash):
    status, _ = call("POST", "/auth/v1/verify", PUBLIC, {"type": "signup", "token_hash": token_hash})
    return status


def admin_create(body):
    status, d = call("POST", "/auth/v1/admin/users", SERVICE, body)
    assert status == 200, (status, d)
    created_auth.append(d["id"])
    return d["id"]


def google_login(addr, meta, confirm_email=True, password=None):
    """A login shaped like a Google sign-up: no password (unless given), Google app metadata.
    Created via an invite link because the admin create endpoint always sets a random password."""
    status, d = call("POST", "/auth/v1/admin/generate_link", SERVICE, {"type": "invite", "email": addr})
    assert status == 200, (status, d)
    uid = d["id"]; created_auth.append(uid)
    body = {"app_metadata": GOOGLE_APP, "user_metadata": meta}
    if password:
        body["password"] = password
    status, d = call("PUT", f"/auth/v1/admin/users/{uid}", SERVICE, body)
    assert status == 200, (status, d)
    if confirm_email:
        status, d = call("PUT", f"/auth/v1/admin/users/{uid}", SERVICE, {"email_confirm": True})
        assert status == 200, (status, d)
    return uid


def remove_auth(uid):
    status, _ = call("DELETE", f"/auth/v1/admin/users/{uid}", SERVICE)
    if uid in created_auth:
        created_auth.remove(uid)
    return status


def pre_register(addr, with_app=False):
    status, rows = call("POST", "/rest/v1/users", SERVICE, {"email": addr, "nickname": addr.split("@")[0][:32]}, "return=representation")
    assert status == 201, (status, rows)
    row_id = rows[0]["id"]; created_rows.append(row_id)
    if with_app:
        status, apps = call("POST", "/rest/v1/apps", SERVICE, {
            "owner_user_id": row_id, "name": "trigger-check", "category": "general", "short_description": "trigger check",
            "store_invite_url": "https://play.google.com/store/apps/details?id=company.knockknock.triggercheck",
            "required_testers": 12, "status": "paused"}, "return=representation")
        assert status == 201, (status, apps)
        created_apps.append(apps[0]["id"])
    return row_id


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


try:
    # S1/S2: email signup — the trigger never makes it a member; only the server's confirm step does
    a = email("a")
    uid, token = signup_link(a)
    check("S1 unconfirmed signup has no member row", member_by_email(a) is None)
    status, outcome = make_member(uid)
    check("S1 server refuses to create a member row before the email is confirmed",
          status == 200 and outcome == "unconfirmed" and member_by_email(a) is None, f"{status} {outcome}")
    check("S2 confirm call succeeds", confirm(token) == 200)
    check("S2 confirming alone does not create a member row", member_by_email(a) is None)
    status, outcome = make_member(uid, "  trg-a  ", "kakao-a")
    row = member_by_email(a)
    check("S2 the server's confirm step creates the member row with the typed nicknames",
          status == 200 and outcome == "linked" and row and row["auth_user_id"] == uid
          and row["nickname"] == "trg-a" and row["kakao_nickname"] == "kakao-a" and row["google_id"] is None, f"{status} {outcome} {row}")
    status, outcome = make_member(uid, "other", "other")
    check("S2 a second call changes nothing", status == 200 and outcome == "already_linked" and member_by_email(a) == row, f"{status} {outcome}")
    status, outcome = rpc("ensure_member_row", {"p_auth_user_id": uid}, SERVICE)
    check("S2 repair call on a linked login reports already_linked", status == 200 and outcome == "already_linked", f"{status} {outcome}")

    # S3: an account confirmed outside our flow (public signup API, forged Google metadata) is not a member
    p = email("p")
    uid_p, token_p = signup_link(p, {"nickname": "x", "iss": "https://accounts.google.com", "sub": f"forged-{TS}"})
    check("S3 confirm call succeeds", confirm(token_p) == 200)
    check("S3 confirmed account has no member row (forged Google metadata ignored)", member_by_email(p) is None)
    status, outcome = rpc("ensure_member_row", {"p_auth_user_id": uid_p}, SERVICE)
    check("S3 repair call refuses it too", status == 200 and outcome == "not_member" and member_by_email(p) is None, f"{status} {outcome}")

    # S4: an email signup never takes a pre-registered row — before or after confirmation, by any path
    b = email("b")
    pre_id = pre_register(b, with_app=True)
    uid_b, token_b = signup_link(b)
    row = member_by_email(b)
    check("S4 unconfirmed signup leaves the pre-registered row untouched",
          row and row["id"] == pre_id and row["auth_user_id"] is None and row["kakao_nickname"] is None, str(row))
    remove_auth(uid_b)
    row = member_by_email(b)
    check("S4 removing the unconfirmed login leaves the pre-registered row and its app",
          row and row["id"] == pre_id and call("GET", f"/rest/v1/apps?id=eq.{created_apps[0]}&select=id", SERVICE)[1] != [], str(row))
    uid_b, token_b = signup_link(b)
    check("S4 confirm call succeeds", confirm(token_b) == 200)
    status, outcome = make_member(uid_b)
    row = member_by_email(b)
    check("S4 the server's confirm step does not hand over the pre-registered row",
          status == 200 and outcome == "email_taken" and row["id"] == pre_id and row["auth_user_id"] is None
          and row["kakao_nickname"] is None and member_by_login(uid_b) is None, f"{status} {outcome} {row}")
    status, outcome = rpc("ensure_member_row", {"p_auth_user_id": uid_b}, SERVICE)
    check("S4 repair call does not hand it over either", status == 200 and member_by_email(b)["auth_user_id"] is None, f"{status} {outcome}")

    # S5: a Google login takes its pre-registered row; consent time is recorded at that moment
    c = email("c")
    pre_c = pre_register(c)
    before = member_by_email(c)
    time.sleep(1.2)
    uid_c = google_login(c, {"iss": "https://accounts.google.com", "sub": f"trg-sub-c-{TS}", "full_name": "Trigger Check"})
    row = member_by_email(c)
    check("S5 Google login takes its pre-registered row and keeps the row's nickname",
          row and row["id"] == pre_c and row["auth_user_id"] == uid_c and row["google_id"] == f"trg-sub-c-{TS}"
          and row["nickname"] == before["nickname"], str(row))
    check("S5 consent time is updated when the row is taken", row and row["terms_agreed_at"] != before["terms_agreed_at"],
          f"{before['terms_agreed_at']} -> {row and row['terms_agreed_at']}")

    # S6: a Google-shaped login that still has a password gets nothing from the trigger
    h = email("h")
    pre_h = pre_register(h)
    uid_h = google_login(h, {"sub": f"trg-sub-h-{TS}"}, password=secrets.token_urlsafe(18))
    row = member_by_email(h)
    check("S6 Google-shaped login with a password is refused the pre-registered row",
          row and row["id"] == pre_h and row["auth_user_id"] is None and member_by_login(uid_h) is None, str(row))
    status, outcome = rpc("ensure_member_row", {"p_auth_user_id": uid_h}, SERVICE)
    row = member_by_email(h)
    check("S6 repair call without a verified Google identity leaves it alone",
          status == 200 and outcome == "password_present" and row["auth_user_id"] is None, f"{status} {outcome} {row}")

    # S7: a brand-new Google login gets a new row named from its Google profile
    d = email("d")
    uid_d = google_login(d, {"iss": "https://accounts.google.com", "sub": f"trg-sub-d-{TS}", "full_name": "N" * 60})
    row = member_by_email(d)
    check("S7 new Google login gets a member row with google id, name clamped to 32 chars",
          row and row["auth_user_id"] == uid_d and row["google_id"] == f"trg-sub-d-{TS}" and row["nickname"] == "N" * 32, str(row))

    # S8: a Google-shaped login whose email is not confirmed gets nothing until it is confirmed
    e = email("e")
    uid_e = google_login(e, {"sub": f"trg-sub-e-{TS}", "full_name": "Late Confirm"}, confirm_email=False)
    check("S8 unconfirmed Google-shaped login has no member row", member_by_email(e) is None)
    status, _ = call("PUT", f"/auth/v1/admin/users/{uid_e}", SERVICE, {"email_confirm": True})
    row = member_by_email(e)
    check("S8 it gets a member row once confirmed", status == 200 and row and row["auth_user_id"] == uid_e, f"{status} {row}")

    # S9: a second login carrying a google id that another row already holds is not blocked
    f = email("f")
    uid_f = google_login(f, {"sub": f"trg-sub-d-{TS}", "full_name": "Dup Sub"})
    row = member_by_email(f)
    check("S9 duplicate google id does not block the login; the id is left empty",
          row and row["auth_user_id"] == uid_f and row["google_id"] is None, str(row))

    # S10: an already-confirmed email login made outside our flow has no member row until the server creates one
    g = email("g")
    password_g = secrets.token_urlsafe(18)
    uid_g = admin_create({"email": g, "password": password_g, "email_confirm": True})
    check("S10 confirmed email login has no member row from the trigger", member_by_email(g) is None)
    status, outcome = make_member(uid_g)
    row = member_by_email(g)
    check("S10 server creates its member row", status == 200 and outcome == "linked" and row and row["auth_user_id"] == uid_g, f"{status} {outcome}")
    status, _ = call("PUT", f"/auth/v1/admin/users/{uid_g}", SERVICE, {"user_metadata": {"note": "touch"}})
    check("S10 later update of a confirmed login is a no-op", status == 200 and member_by_email(g) == row)

    # S11 (000024 + function privileges): what a signed-in member can do through the public API
    status, session = call("POST", "/auth/v1/token?grant_type=password", PUBLIC, {"email": g, "password": password_g})
    assert status == 200, (status, session)
    jwt = session["access_token"]
    status_read, own = call("GET", f"/rest/v1/users?auth_user_id=eq.{uid_g}&select=id,email", PUBLIC, bearer=jwt)
    check("S11 member can still read their own row", status_read == 200 and own and own[0]["id"] == row["id"], f"{status_read} {own}")
    status_write, body = call("PATCH", f"/rest/v1/users?id=eq.{row['id']}", PUBLIC,
                              {"email": email("hijack"), "google_id": "x"}, prefer="return=representation", bearer=jwt)
    _, still = call("GET", f"/rest/v1/users?id=eq.{row['id']}&select=email,google_id", SERVICE)
    check("S11 member cannot change email or google id on their own row",
          status_write in (401, 403) and still and still[0]["email"] == g and still[0]["google_id"] is None,
          f"{status_write} {body} {still}")
    for name, args in (("ensure_member_row", {"p_auth_user_id": uid_b}),
                       ("create_email_member", {"p_auth_user_id": uid_b, "p_nickname": "x", "p_kakao_nickname": "y"}),
                       ("link_auth_user", {"p_auth_user_id": uid_b, "p_trusted": True})):
        s_member, _ = rpc(name, args, PUBLIC, bearer=jwt)
        s_anon, _ = rpc(name, args, PUBLIC)
        check(f"S11 {name} is not callable by members or anonymous callers", s_member in (401, 403, 404) and s_anon in (401, 403, 404),
              f"member={s_member} anon={s_anon}")
    s_service, _ = rpc("link_auth_user", {"p_auth_user_id": uid_b, "p_trusted": True}, SERVICE)
    check("S11 link_auth_user is not callable even with the service key", s_service in (401, 403, 404), f"service={s_service}")
    check("S11 pre-registered row still unlinked after those calls", member_by_email(b)["auth_user_id"] is None)
finally:
    for uid in list(created_auth):
        remove_auth(uid)
    for app_id in created_apps:
        call("DELETE", f"/rest/v1/apps?id=eq.{app_id}", SERVICE)
    for row_id in created_rows:
        call("DELETE", f"/rest/v1/users?id=eq.{row_id}&email=like.delivered%2Btrg*%40resend.dev", SERVICE)
    _, left = call("GET", "/rest/v1/users?email=like.delivered%2Btrg*%40resend.dev&select=id", SERVICE)
    print("cleanup: leftover test member rows =", left)

print(f"{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
