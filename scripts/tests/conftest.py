import os
import pytest


@pytest.fixture(scope="session")
def app_instance():
    # Ensure a deterministic secret in CI and enable testing mode
    os.environ.setdefault("FLASK_ENV", "testing")
    os.environ.setdefault("SECRET_KEY", "test-secret-key")

    # Import after env is set so Flask picks up values
    from app import app as flask_app  # app.py lives in scripts/, working dir is scripts during CI

    flask_app.config.update({
        "TESTING": True,
    })
    return flask_app


@pytest.fixture()
def client(app_instance):
    return app_instance.test_client()
