"""Shared pytest setup. Tests use an isolated MongoDB database and never call live AI providers."""

import os
import uuid

# Must be set before config/models are imported; load_dotenv does not override existing variables.
os.environ["MONGODB_DB"] = "matchmytone_test"
os.environ["RESEND_API_KEY"] = ""
os.environ["FROM_EMAIL"] = "MatchMyTone <noreply@mail.matchmytone.test>"
os.environ["FRONTEND_URL"] = "http://localhost:3000"
# Most tests exercise features of an already-verified flow; test_security.py switches verification on explicitly.
os.environ["REQUIRE_EMAIL_VERIFICATION"] = "false"
os.environ.pop("APP_ENV", None)
os.environ.pop("RENDER", None)

import pytest  # noqa: E402

import color_providers  # noqa: E402
import config  # noqa: E402
import models  # noqa: E402


def _drop_test_database():
    if not models.db.name.endswith("_test"):
        raise RuntimeError(f"Refusing to drop non-test database {models.db.name!r}")
    models.client.drop_database(models.db.name)


@pytest.fixture(scope="session", autouse=True)
def test_database():
    _drop_test_database()
    models.initialize_database()
    yield models.db
    _drop_test_database()


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Every test starts with empty abuse counters (the test client always uses the same address)."""
    models.rate_events.delete_many({})
    yield


@pytest.fixture(autouse=True)
def isolated_providers(monkeypatch):
    """Deterministic provider configuration; any unexpected network call fails the test."""
    color_providers.reset_state()
    monkeypatch.setattr(config, "GEMINI_API_KEY", "gemini-test-key")
    monkeypatch.setattr(config, "GEMINI_MODEL", "gemini-primary")
    monkeypatch.setattr(config, "GEMINI_FALLBACK_MODELS", ("gemini-secondary",))
    monkeypatch.setattr(config, "OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setattr(config, "OPENAI_VISION_MODEL", "gpt-vision")
    monkeypatch.setattr(config, "COLOR_ANALYSIS_MAX_SECONDS", 60)

    def no_network(*args, **kwargs):
        raise AssertionError("Unexpected live network call in a unit test")

    monkeypatch.setattr(color_providers, "urlopen", no_network)
    yield
    color_providers.reset_state()


@pytest.fixture
def client():
    import app
    return app.app.test_client()


@pytest.fixture
def make_user(client):
    """Register and log in a fresh user; returns (auth headers, public user)."""
    counter = iter(range(10_000))

    def create(gender="other"):
        suffix = f"{os.getpid()}{next(counter)}{uuid.uuid4().hex[:8]}"
        details = {"name": f"Test {suffix}", "email": f"Test.{suffix}@Example.com", "password": "ValidPass!123", "gender": gender, "dob": "1995-05-05", "age": 31}
        assert client.post("/api/auth/register", json=details).status_code == 201
        login = client.post("/api/auth/login", json={"email": details["email"], "password": details["password"]})
        assert login.status_code == 200
        user = login.get_json()["user"]
        return {"Authorization": f"Bearer {user['token']}"}, user

    return create
