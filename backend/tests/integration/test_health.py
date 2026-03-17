"""Integration tests for public system endpoints: /health and /models."""


class TestHealth:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_ok_status(self, client):
        response = client.get("/health")
        assert response.json() == {"status": "ok"}

    def test_health_requires_no_auth(self, client):
        """Health endpoint should work without an Authorization header."""
        response = client.get("/health")
        assert response.status_code == 200


class TestModels:
    def test_models_returns_200(self, client):
        response = client.get("/models")
        assert response.status_code == 200

    def test_models_response_has_required_keys(self, client):
        response = client.get("/models")
        data = response.json()
        assert "models" in data
        assert "default" in data

    def test_models_list_is_a_list(self, client):
        response = client.get("/models")
        data = response.json()
        assert isinstance(data["models"], list)

    def test_models_default_is_a_string(self, client):
        response = client.get("/models")
        data = response.json()
        assert isinstance(data["default"], str)

    def test_models_requires_no_auth(self, client):
        """Models endpoint is public – no Authorization header needed."""
        response = client.get("/models")
        assert response.status_code == 200
