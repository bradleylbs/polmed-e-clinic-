def test_login_missing_body(client):
    resp = client.post('/api/auth/login', json=None)
    assert resp.status_code == 400
    data = resp.get_json()
    assert data.get('success') is False
    assert 'Invalid request format' in data.get('error', '')


def test_login_invalid_email_format(client):
    resp = client.post('/api/auth/login', json={"email": "invalid", "password": "x"})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data.get('success') is False
    assert 'valid email' in data.get('error', '').lower()
