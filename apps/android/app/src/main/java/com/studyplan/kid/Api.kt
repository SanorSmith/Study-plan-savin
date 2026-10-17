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

data class Progress(val done: Int, val total: Int)

/** A message from a parent: a checked paper, a note, or new practice. */
data class KidMessage(val id: String, val kind: String, val body: String)

data class PaperSet(val id: String, val subject: String)

data class KidState(
    val serverNow: String,
    val name: String,
    val balanceMinutes: Int,
    val minutesPerQuestion: Int,
    val earnableTodayMinutes: Int,
    val question: Question?,
    val schedule: Schedule,
    val approvedUntil: String?,
    val paperSets: List<PaperSet>,
    val aiCheckEnabled: Boolean,
    val grade: Int,
    val uiStyle: String,
    val progress: Progress?,
    val messages: List<KidMessage>,
)

data class SyncData(val balanceMinutes: Int, val serverNow: String, val schedule: Schedule, val approvedUntil: String?)

data class ApprovalResult(val approvedUntil: String, val serverNow: String)

data class UsageResult(val balanceMinutes: Int, val serverNow: String)

/** What happened to a paper: sent to a parent, or checked by the AI with minutes added at once. */
data class PaperResult(val checkedByAi: Boolean, val correct: Int, val total: Int, val minutes: Int)

data class AnswerResult(val correct: Boolean, val earnedMinutes: Int, val attemptsLeft: Int)

/** Talks to the Study Plan web API with the device token as a bearer token. */
object Api {
    private suspend fun call(
        method: String,
        path: String,
        token: String?,
        body: JSONObject? = null,
        raw: Pair<String, ByteArray>? = null, // content type and bytes, for uploads
        readTimeoutMs: Int = 15_000,
    ): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = URL(BuildConfig.API_BASE_URL + path).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 10_000
                conn.readTimeout = readTimeoutMs
                conn.setRequestProperty("accept", "application/json")
                if (BuildConfig.API_BYPASS.isNotEmpty()) {
                    conn.setRequestProperty("x-vercel-protection-bypass", BuildConfig.API_BYPASS)
                }
                token?.let { conn.setRequestProperty("authorization", "Bearer $it") }
                if (raw != null) {
                    conn.doOutput = true
                    conn.setFixedLengthStreamingMode(raw.second.size)
                    conn.setRequestProperty("content-type", raw.first)
                    conn.outputStream.use { it.write(raw.second) }
                } else if (body != null) {
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
            approvedUntil = if (j.isNull("approvedUntil")) null else j.getString("approvedUntil"),
            paperSets = j.optJSONArray("paperSets")?.let { a ->
                List(a.length()) { i -> PaperSet(a.getJSONObject(i).getString("id"), a.getJSONObject(i).getString("subject")) }
            } ?: emptyList(),
            aiCheckEnabled = j.optBoolean("aiCheckEnabled", false),
            grade = j.optInt("grade", 5),
            uiStyle = j.optString("uiStyle", "auto"),
            progress = j.optJSONObject("progress")?.let { Progress(it.getInt("done"), it.getInt("total")) },
            messages = j.optJSONArray("messages")?.let { a ->
                List(a.length()) { i -> a.getJSONObject(i).let { KidMessage(it.getString("id"), it.getString("kind"), it.getString("body")) } }
            } ?: emptyList(),
        )
    }

    suspend fun answer(token: String, questionId: String, answer: String): AnswerResult {
        val j = call("POST", "/api/kid/answer", token, JSONObject().put("questionId", questionId).put("answer", answer))
        return AnswerResult(j.getBoolean("correct"), j.getInt("earnedMinutes"), j.getInt("attemptsLeft"))
    }

    /** The kid has read these messages. */
    suspend fun readMessages(token: String, ids: List<String>) {
        call("POST", "/api/kid/messages/read", token, JSONObject().put("ids", org.json.JSONArray(ids)))
    }

    /** Balance, schedule and server clock for the lock. Needs no PIN. */
    suspend fun sync(token: String): SyncData {
        val j = call("GET", "/api/kid/sync", token)
        return SyncData(
            j.getInt("balanceMinutes"),
            j.getString("serverNow"),
            scheduleFromJson(j.getJSONObject("schedule")),
            if (j.isNull("approvedUntil")) null else j.getString("approvedUntil"),
        )
    }

    /** Reports screen time used. Sending the same [key] again never charges twice. */
    suspend fun usage(token: String, minutes: Int, key: String): UsageResult {
        val j = call("POST", "/api/kid/usage", token, JSONObject().put("minutes", minutes).put("key", key))
        return UsageResult(j.getInt("balanceMinutes"), j.getString("serverNow"))
    }

    /** A parent types their PIN on the phone; Settings and uninstall screens open for a few minutes. */
    suspend fun parentUnlock(token: String, pin: String): ApprovalResult {
        val j = call("POST", "/api/kid/parent-unlock", token, JSONObject().put("pin", pin))
        return ApprovalResult(j.getString("approvedUntil"), j.getString("serverNow"))
    }

    /**
     * Sends photos or PDFs of a finished paper. [mode] is "ai" (the AI checks it and the minutes are added at once, only if a
     * parent turned that on) or "parent" (a parent checks the photos by hand).
     */
    suspend fun uploadPaper(token: String, setId: String, files: List<UploadFile>, mode: String): PaperResult {
        val boundary = "----studyplan" + System.nanoTime()
        val body = multipartBody(
            boundary,
            mapOf("setId" to setId, "mode" to mode),
            files.map { FilePart("image", it.name, it.contentType, it.bytes) },
        )
        val j = call("POST", "/api/kid/paper", token, raw = "multipart/form-data; boundary=$boundary" to body, readTimeoutMs = 90_000)
        return if (j.optString("mode") == "ai") {
            PaperResult(true, j.getInt("correct"), j.getInt("total"), j.getInt("minutes"))
        } else {
            PaperResult(false, 0, 0, 0)
        }
    }
}
