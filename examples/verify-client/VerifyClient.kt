/**
 * Kotlin/Android reference client for the encrypted + signed /api/verify
 * protocol. Uses only javax.crypto (built into Android) plus OkHttp for
 * networking.
 *
 * build.gradle.kts:
 *   implementation("com.squareup.okhttp3:okhttp:4.12.0")
 *
 * Usage:
 *   val client = VerifyClient(
 *       baseUrl = "https://your-app.vercel.app",
 *       encryptionKeyB64 = "...",  // same value as server's API_ENCRYPTION_KEY
 *       hmacSecret = "...",       // same value as server's API_HMAC_SECRET
 *   )
 *   val result = client.verifyLicense(key = "SOME-LICENSE-KEY", deviceId = "device-123")
 *   if (result.valid) { /* unlock feature */ }
 *
 * IMPORTANT: don't hardcode encryptionKeyB64 / hmacSecret as plain string
 * literals in a shipped APK — they're trivially extractable with a
 * decompiler. At minimum obfuscate/split them (R8/ProGuard string
 * encryption, or load from native code via JNI) so they're not sitting
 * as a plain constant in the bytecode.
 */

import android.util.Base64
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.security.SecureRandom

data class VerifyResult(
    val valid: Boolean,
    val message: String,
    val key: String? = null,
    val status: String? = null,
    val expiresAt: String? = null,
    val deviceBound: Boolean? = null,
)

class VerifyClient(
    private val baseUrl: String,
    encryptionKeyB64: String,
    private val hmacSecret: String,
) {
    private val encryptionKey = Base64.decode(encryptionKeyB64, Base64.NO_WRAP).also {
        require(it.size == 32) { "encryptionKeyB64 must decode to 32 bytes (AES-256)" }
    }
    private val http = OkHttpClient()
    private val jsonMediaType = "application/json".toMediaType()

    private fun encrypt(plaintext: String): JSONObject {
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(encryptionKey, "AES"), GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        // Java's GCM cipher appends the 16-byte auth tag to the ciphertext.
        val tag = encrypted.copyOfRange(encrypted.size - 16, encrypted.size)
        val data = encrypted.copyOfRange(0, encrypted.size - 16)
        return JSONObject().apply {
            put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            put("tag", Base64.encodeToString(tag, Base64.NO_WRAP))
            put("data", Base64.encodeToString(data, Base64.NO_WRAP))
        }
    }

    private fun decrypt(envelope: JSONObject): String {
        val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
        val tag = Base64.decode(envelope.getString("tag"), Base64.NO_WRAP)
        val data = Base64.decode(envelope.getString("data"), Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(encryptionKey, "AES"), GCMParameterSpec(128, iv))
        val decrypted = cipher.doFinal(data + tag)
        return String(decrypted, Charsets.UTF_8)
    }

    private fun sign(timestamp: String, body: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(hmacSecret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val raw = mac.doFinal("$timestamp.$body".toByteArray(Charsets.UTF_8))
        return raw.joinToString("") { "%02x".format(it) }
    }

    private fun verifySignatureConstantTime(a: String, b: String): Boolean {
        // Constant-time comparison — avoid a plain `==` on signatures.
        return MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))
    }

    /** Blocking call — run this off the main thread (coroutine/IO dispatcher, WorkManager, etc). */
    fun verifyLicense(key: String, deviceId: String): VerifyResult {
        // 1. Build + encrypt the request body.
        val plaintext = JSONObject().apply {
            put("key", key)
            put("device_id", deviceId)
        }.toString()
        val envelope = encrypt(plaintext)
        val bodyString = envelope.toString()

        // 2. Sign it.
        val timestamp = System.currentTimeMillis().toString()
        val signature = sign(timestamp, bodyString)

        // 3. Send it.
        val request = Request.Builder()
            .url("$baseUrl/api/verify")
            .addHeader("X-Timestamp", timestamp)
            .addHeader("X-Signature", signature)
            .post(bodyString.toRequestBody(jsonMediaType))
            .build()

        http.newCall(request).execute().use { response ->
            val responseText = response.body?.string().orEmpty()
            val responseTimestamp = response.header("X-Timestamp")
            val responseSignature = response.header("X-Signature")

            // 4. Verify the response signature BEFORE trusting anything in it.
            //    This is what stops a tampered/replayed response from a
            //    proxy tool (Fiddler/Charles/Frida) sitting on the device.
            if (responseTimestamp == null || responseSignature == null) {
                throw SecurityException("Response missing signature headers — refusing to trust it")
            }
            val expectedSignature = sign(responseTimestamp, responseText)
            if (!verifySignatureConstantTime(expectedSignature, responseSignature)) {
                throw SecurityException("Response signature is invalid — possible tampering. Refusing to trust it")
            }

            // 5. Only now decrypt and parse.
            val responseEnvelope = JSONObject(responseText)
            val decrypted = decrypt(responseEnvelope)
            val json = JSONObject(decrypted)
            return VerifyResult(
                valid = json.getBoolean("valid"),
                message = json.getString("message"),
                key = json.optString("key", null),
                status = json.optString("status", null),
                expiresAt = json.optString("expires_at", null),
                deviceBound = if (json.has("device_bound")) json.getBoolean("device_bound") else null,
            )
        }
    }
}
