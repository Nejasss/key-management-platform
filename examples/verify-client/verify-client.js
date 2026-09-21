/**
 * Node.js reference client for the encrypted + signed /api/verify
 * protocol. Requires Node 18+ (for global fetch) and no extra
 * dependencies — everything here is Node's built-in `crypto` module.
 *
 * Usage:
 *   API_ENCRYPTION_KEY=... API_HMAC_SECRET=... \
 *     node verify-client.js https://your-app.vercel.app SOME-LICENSE-KEY device-123
 *
 * The two env vars must match the server's API_ENCRYPTION_KEY /
 * API_HMAC_SECRET exactly (same base64 strings).
 */

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(envVar) {
  const b64 = process.env[envVar];
  if (!b64) throw new Error(`${envVar} is not set`);
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error(`${envVar} must decode to 32 bytes`);
  return key;
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decrypt(envelope, key) {
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function sign(timestamp, body, hmacSecret) {
  return crypto.createHmac('sha256', hmacSecret).update(`${timestamp}.${body}`).digest('hex');
}

function verifySignature(timestamp, body, signature, hmacSecret) {
  const expected = Buffer.from(sign(timestamp, body, hmacSecret), 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

async function verifyLicense(baseUrl, key, deviceId) {
  const encKey = getKey('API_ENCRYPTION_KEY');
  const hmacSecret = process.env.API_HMAC_SECRET;
  if (!hmacSecret) throw new Error('API_HMAC_SECRET is not set');

  // 1. Build + encrypt the request body.
  const plaintext = JSON.stringify({ key, device_id: deviceId });
  const envelope = encrypt(plaintext, encKey);
  const bodyString = JSON.stringify(envelope);

  // 2. Sign it.
  const timestamp = Date.now().toString();
  const signature = sign(timestamp, bodyString, hmacSecret);

  // 3. Send it.
  const res = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
    body: bodyString,
  });

  const responseText = await res.text();
  const responseTimestamp = res.headers.get('x-timestamp');
  const responseSignature = res.headers.get('x-signature');

  // 4. Verify the response signature BEFORE trusting anything in it.
  //    This is what stops a tampered/replayed response from a proxy
  //    tool sitting on the device.
  if (!responseTimestamp || !responseSignature) {
    throw new Error('Response missing signature headers — refusing to trust it');
  }
  if (!verifySignature(responseTimestamp, responseText, responseSignature, hmacSecret)) {
    throw new Error('Response signature is invalid — possible tampering. Refusing to trust it');
  }

  // 5. Only now decrypt and parse.
  const responseEnvelope = JSON.parse(responseText);
  const decrypted = decrypt(responseEnvelope, encKey);
  return JSON.parse(decrypted);
}

if (require.main === module) {
  const [baseUrl, key, deviceId] = process.argv.slice(2);
  if (!baseUrl || !key || !deviceId) {
    console.error('Usage: node verify-client.js <baseUrl> <licenseKey> <deviceId>');
    process.exit(1);
  }
  verifyLicense(baseUrl, key, deviceId)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error('Verification failed:', err.message);
      process.exit(1);
    });
}

module.exports = { verifyLicense };
