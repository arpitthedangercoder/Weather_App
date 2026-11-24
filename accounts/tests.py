from django.test import TestCase

PASSWORD = "Strong#Pass2026"


class JwtAuthTests(TestCase):
    def post(self, url, data):
        return self.client.post(url, data, content_type="application/json")

    def register(self, name="asha"):
        return self.post("/api/register/", {"username": name, "password": PASSWORD})

    def test_register_returns_tokens_and_me_works(self):
        r = self.register()
        self.assertEqual(r.status_code, 201)
        access = r.json()["access"]
        me = self.client.get("/api/me/", HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["username"], "asha")

    def test_me_requires_token(self):
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    def test_login_and_wrong_password(self):
        self.register()
        ok = self.post("/api/login/", {"username": "asha", "password": PASSWORD})
        self.assertEqual(ok.status_code, 200)
        self.assertIn("access", ok.json())
        bad = self.post("/api/login/", {"username": "asha", "password": "nope"})
        self.assertEqual(bad.status_code, 401)

    def test_refresh_then_logout_blacklists(self):
        refresh = self.register().json()["refresh"]
        r = self.post("/api/token/refresh/", {"refresh": refresh})
        self.assertEqual(r.status_code, 200)
        new_refresh = r.json()["refresh"]          # rotation gives a new one
        self.assertEqual(self.post("/api/logout/", {"refresh": new_refresh}).status_code, 200)
        self.assertEqual(self.post("/api/token/refresh/", {"refresh": new_refresh}).status_code, 401)

    def test_duplicate_and_weak_password(self):
        self.register()
        self.assertEqual(self.register("ASHA").status_code, 409)
        self.assertEqual(self.post("/api/register/", {"username": "ravi", "password": "123"}).status_code, 400)
