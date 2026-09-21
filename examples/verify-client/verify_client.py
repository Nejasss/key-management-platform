"""
Python reference client for the encrypted + signed /api/verify protocol.

Install dependencies:
    pip install cryptography requests

Usage:
    API_ENCRYPTION_KEY=... API_HMAC_SECRET=... \
        python verify_client.py https://your-app.vercel.app SOME-LICENSE-KEY device-123

The two env vars must match the server's API_ENCRYPTION_KEY /
API_HMAC_SECRET exactly (same base64 strings).
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import time

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_key(env_var: str) -> bytes:
    b64 = os.environ.get(env_var)
    if not b64:
        raise RuntimeError(f"{env_var} is not set")
    key = base64.b64decode(b64)
    if len(key) != 32:
        raise RuntimeError(f"{env_var} must decode to 32 bytes")
    return key


def _encrypt(plaintext: str, key: bytes) -> dict:
    aesgcm = AESGCM(key)
    iv = os.urandom(12)
    # AESGCM.encrypt() appends the 16-byte auth tag to the ciphertext.
    ciphertext_and_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    ciphertext, tag = ciphertext_and_tag[:-16], ciphertext_and_tag[-16:]
    return {
        "iv": base64.b64encode(iv).decode(),
        "tag": base64.b64encode(tag).decode(),
        "data": base64.b64encode(ciphertext).decode(),
    }


def _decrypt(envelope: dict, key: bytes) -> str:
    aesgcm = AESGCM(key)
    iv = base64.b64decode(envelope["iv"])
    tag = base64.b64decode(envelope["tag"])
    data = base64.b64decode(envelope["data"])
    plaintext = aesgcm.decrypt(iv, data + tag, None)
    return plaintext.decode("utf-8")


def _sign(timestamp: str, body: str, hmac_secret: str) -> str:
    message = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(hmac_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _verify_signature(timestamp: str, body: str, signature: str, hmac_secret: str) -> bool:
    expected = _sign(timestamp, body, hmac_secret)
    return hmac.compare_digest(expected, signature)


def verify_license(base_url: str, key: str, device_id: str) -> dict:
    enc_key = _get_key("API_ENCRYPTION_KEY")
    hmac_secret = os.environ.get("API_HMAC_SECRET")
    if not hmac_secret:
        raise RuntimeError("API_HMAC_SECRET is not set")

    # 1. Build + encrypt the request body.
    plaintext = json.dumps({"key": key, "device_id": device_id})
    envelope = _encrypt(plaintext, enc_key)
    body_string = json.dumps(envelope)

    # 2. Sign it.
    timestamp = str(int(time.time() * 1000))
    signature = _sign(timestamp, body_string, hmac_secret)

    # 3. Send it.
    response = requests.post(
        f"{base_url}/api/verify",
        headers={
            "Content-Type": "application/json",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        },
        data=body_string,
        timeout=10,
    )

    response_text = response.text
    response_timestamp = response.headers.get("X-Timestamp")
    response_signature = response.headers.get("X-Signature")

    # 4. Verify the response signature BEFORE trusting anything in it.
    #    This is what stops a tampered/replayed response from a proxy
    #    tool sitting on the device.
    if not response_timestamp or not response_signature:
        raise RuntimeError("Response missing signature headers — refusing to trust it")
    if not _verify_signature(response_timestamp, response_text, response_signature, hmac_secret):
        raise RuntimeError("Response signature is invalid — possible tampering. Refusing to trust it")

    # 5. Only now decrypt and parse.
    response_envelope = json.loads(response_text)
    decrypted = _decrypt(response_envelope, enc_key)
    return json.loads(decrypted)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python verify_client.py <baseUrl> <licenseKey> <deviceId>")
        sys.exit(1)

    base_url, license_key, device_id = sys.argv[1], sys.argv[2], sys.argv[3]
    try:
        result = verify_license(base_url, license_key, device_id)
        print(json.dumps(result, indent=2))
    except Exception as exc:  # noqa: BLE001
        print(f"Verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
