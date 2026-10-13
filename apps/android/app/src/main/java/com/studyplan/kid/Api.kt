package com.studyplan.kid

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

class ApiException(val status: Int, message: String) : Exception(message)

data class Question(
    val id: String,
    val text: String,
    val type: String,
    val options: List<String>?,
    val subject: String,
)

data class KidState(
    val serverNow: String,
    val name: String,
    val balanceMinutes: Int,
    val minutesPerQuestion: Int,
    val earnableTodayMinutes: Int,
    val question: Question?,
    val schedule: Schedule,
)

data class SyncData(val balanceMinutes: Int, val serverNow: String, val schedule: Schedule)

data class UsageResult(val balanceMinutes: Int, val serverNow: String)

data class AnswerResult(val correct: Boolean, val earnedMinutes: Int, val attemptsLeft: Int)

/** Talks to the Study Plan web API with the device token as a bearer token. */
object Api {
    private suspend fun call(method: String, path: String, token: String?, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = URL(BuildConfig.API_BASE_URL + path).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 10_000
                conn.readTimeout = 15_000
                conn.setRequestProperty("accept", "application/json")
                if (BuildConfig.API_BYPASS.isNotEmpty()) {
                    conn.setRequestProperty("x-vercel-protection-bypass", BuildConfig.API_BYPASS)
                }
                token?.let { conn.setRequestProperty("authorization", "Bearer $it") }
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("content-type", "application/json")
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val status = conn.responseCode
                val text = (if (status in 200..299) conn.inputStream else conn.errorStream)
                    ?.bufferedReader()?.use { it.readText() }.orEmpty()
                val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
                if (status !in 200..299) throw ApiException(status, json.optString("error", "Error $status"))
                json
            } finally {
                conn.disconnect()
            }
        }

    suspend fun pair(code: String): String =
        call("POST", "/api/device/pair", null, JSONObject().put("code", code)).getString("token")

    suspend fun unlock(token: String, pin: String) {
        call("POST", "/api/kid/unlock", token, JSONObject().put("pin", pin))
    }

    suspend fun state(token: String): KidState {
        val j = call("GET", "/api/kid/state", token)
        val q = j.optJSONObject("question")
        return KidState(
            serverNow = j.getString("serverNow"),
            name = j.getString("name"),
            balanceMinutes = j.getInt("balanceMinutes"),
            minutesPerQuestion = j.getInt("minutesPerQuestion"),
            earnableTodayMinutes = j.getInt("earnableTodayMinutes"),
            question = q?.let {
                Question(
                    id = it.getString("id"),
                    text = it.getString("text"),
                    type = it.getString("type"),
                    options = it.optJSONArray("options")?.let { a -> List(a.length()) { i -> a.getString(i) } },
                    subject = it.getString("subject"),
                )
            },
            schedule = scheduleFromJson(j.getJSONObject("schedule")),
        )
    }

    suspend fun answer(token: String, questionId: String, answer: String): AnswerResult {
        val j = call("POST", "/api/kid/answer", token, JSONObject().put("questionId", questionId).put("answer", answer))
        return AnswerResult(j.getBoolean("correct"), j.getInt("earnedMinutes"), j.getInt("attemptsLeft"))
    }

    /** Balance, schedule and server clock for the lock. Needs no PIN. */
    suspend fun sync(token: String): SyncData {
        val j = call("GET", "/api/kid/sync", token)
        return SyncData(j.getInt("balanceMinutes"), j.getString("serverNow"), scheduleFromJson(j.getJSONObject("schedule")))
    }

    /** Reports screen time used. Sending the same [key] again never charges twice. */
    suspend fun usage(token: String, minutes: Int, key: String): UsageResult {
        val j = call("POST", "/api/kid/usage", token, JSONObject().put("minutes", minutes).put("key", key))
        return UsageResult(j.getInt("balanceMinutes"), j.getString("serverNow"))
    }
}
