package com.studyplan.parent

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class ApiException(val status: Int, message: String) : Exception(message)

/** Talks to the Study Plan web API as a parent, with the token from pairing as a bearer token. */
object ParentApi {
    private fun open(method: String, path: String, token: String?): HttpURLConnection {
        val conn = URL(BuildConfig.API_BASE_URL + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 10_000
        conn.readTimeout = 20_000
        token?.let { conn.setRequestProperty("authorization", "Bearer $it") }
        return conn
    }

    private suspend fun call(method: String, path: String, token: String?, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = open(method, path, token)
            try {
                conn.setRequestProperty("accept", "application/json")
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("content-type", "application/json")
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val status = conn.responseCode
                val text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
                if (status !in 200..299) throw ApiException(status, json.optString("error", "Error $status"))
                json
            } finally {
                conn.disconnect()
            }
        }

    suspend fun pair(code: String, phoneName: String): String =
        call("POST", "/api/parent/pair", null, JSONObject().put("code", code).put("name", phoneName)).getString("token")

    suspend fun state(token: String): ParentState {
        val j = call("GET", "/api/parent/state", token)
        return ParentState(
            kids = j.getJSONArray("kids").objects().map {
                KidSummary(
                    id = it.getString("id"),
                    name = it.getString("name"),
                    grade = it.getInt("grade"),
                    balanceMinutes = it.getInt("balanceMinutes"),
                    pairedPhones = it.getInt("pairedPhones"),
                    aiCheckEnabled = it.getBoolean("aiCheckEnabled"),
                    approvedForSettings = it.getBoolean("approvedForSettings"),
                    papersToReview = it.getInt("papersToReview"),
                )
            },
            papers = j.getJSONArray("papers").objects().map {
                PaperItem(it.getString("id"), it.getString("kidId"), it.getString("kidName"), it.getString("subject"), it.getString("createdAt"))
            },
        )
    }

    private suspend fun kidAction(token: String, kidId: String, body: JSONObject): ActionResult {
        val j = call("POST", "/api/parent/kids/$kidId", token, body)
        return ActionResult(j.getInt("changedMinutes"), j.getInt("balanceMinutes"))
    }

    suspend fun bonus(token: String, kidId: String, minutes: Int) = kidAction(token, kidId, JSONObject().put("action", "bonus").put("minutes", minutes))
    suspend fun withdraw(token: String, kidId: String, minutes: Int) = kidAction(token, kidId, JSONObject().put("action", "withdraw").put("minutes", minutes))
    suspend fun emptyBank(token: String, kidId: String) = kidAction(token, kidId, JSONObject().put("action", "reset"))
    suspend fun setAi(token: String, kidId: String, enabled: Boolean) = kidAction(token, kidId, JSONObject().put("action", "ai").put("enabled", enabled))
    suspend fun allowSettings(token: String, kidId: String, allow: Boolean) =
        kidAction(token, kidId, JSONObject().put("action", if (allow) "allow_settings" else "block_settings"))

    suspend fun paper(token: String, id: String): PaperDetail {
        val j = call("GET", "/api/parent/papers/$id", token)
        return PaperDetail(
            id = j.getString("id"),
            kidName = j.getString("kidName"),
            subject = j.getString("subject"),
            status = j.getString("status"),
            mode = j.getString("mode"),
            aiRead = j.getBoolean("aiRead"),
            autoApproved = j.getBoolean("autoApproved"),
            awardedMinutes = j.optInt("awardedMinutes", 0),
            imageCount = j.getInt("imageCount"),
            imageTypes = j.optJSONArray("imageTypes")?.let { a -> List(a.length()) { i -> a.getString(i) } } ?: emptyList(),
            answers = j.getJSONArray("answers").objects().map {
                PaperAnswer(
                    questionId = it.getString("questionId"),
                    text = it.getString("text"),
                    answerKey = it.optString("answerKey", ""),
                    readAnswer = if (it.isNull("readAnswer")) null else it.getString("readAnswer"),
                    aiCorrect = it.optBoolean("aiCorrect", false),
                    legible = it.optBoolean("legible", false),
                    note = if (it.isNull("note")) null else it.getString("note"),
                    alreadySolved = it.optBoolean("alreadySolved", false),
                    finalCorrect = if (it.isNull("finalCorrect")) null else it.getBoolean("finalCorrect"),
                )
            },
        )
    }

    suspend fun approve(token: String, id: String, correct: Set<String>): DecisionResult {
        val j = call("POST", "/api/parent/papers/$id", token, JSONObject().put("decision", "approve").put("correct", JSONArray(correct.toList())))
        return DecisionResult(j.getInt("awardedMinutes"), j.getInt("correctCount"), j.getInt("total"))
    }

    suspend fun reject(token: String, id: String) {
        call("POST", "/api/parent/papers/$id", token, JSONObject().put("decision", "reject"))
    }

    /** The bytes of one photo of a paper. */
    suspend fun image(token: String, id: String, index: Int): ByteArray =
        withContext(Dispatchers.IO) {
            val conn = open("GET", "/api/parent/papers/$id/image/$index", token)
            try {
                val status = conn.responseCode
                if (status !in 200..299) {
                    val text = conn.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
                    throw ApiException(status, runCatching { JSONObject(text).optString("error") }.getOrNull().orEmpty().ifEmpty { "Error $status" })
                }
                conn.inputStream.use { it.readBytes() }
            } finally {
                conn.disconnect()
            }
        }

    private suspend fun raw(method: String, path: String, token: String, contentType: String, bytes: ByteArray, readTimeoutMs: Int): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = open(method, path, token)
            try {
                conn.readTimeout = readTimeoutMs
                conn.setRequestProperty("accept", "application/json")
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(bytes.size)
                conn.setRequestProperty("content-type", contentType)
                conn.outputStream.use { it.write(bytes) }
                val status = conn.responseCode
                val text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                val json = runCatching { JSONObject(text) }.getOrDefault(JSONObject())
                if (status !in 200..299) throw ApiException(status, json.optString("error", "Error $status"))
                json
            } finally {
                conn.disconnect()
            }
        }

    suspend fun kid(token: String, id: String): KidDetail {
        val j = call("GET", "/api/parent/kids/$id", token)
        return KidDetail(
            id = j.getString("id"),
            name = j.getString("name"),
            grade = j.getInt("grade"),
            minutesPerQuestion = j.getInt("minutesPerQuestion"),
            dailyCapMinutes = j.getInt("dailyCapMinutes"),
            uiStyle = j.getString("uiStyle"),
            hasPin = j.getBoolean("hasPin"),
            balanceMinutes = j.getInt("balanceMinutes"),
            earnedTodayMinutes = j.getInt("earnedTodayMinutes"),
            aiCheckEnabled = j.getBoolean("aiCheckEnabled"),
            approvedForSettings = j.getBoolean("approvedForSettings"),
            schedule = j.getJSONArray("schedule").objects().map { RuleInfo(it.getString("id"), it.getString("mode"), it.getInt("days"), it.getInt("startMinute"), it.getInt("endMinute")) },
            phones = j.getJSONArray("phones").objects().map { PhoneInfo(it.getString("id"), it.getString("platform"), it.getBoolean("paired"), if (it.isNull("code")) null else it.getString("code")) },
            homework = j.getJSONArray("homework").objects().map { h ->
                HomeworkInfo(
                    h.getString("id"), h.getString("subject"), h.getString("createdAt"), h.getInt("solved"), h.getInt("total"), h.getInt("earnedMinutes"),
                    h.getJSONArray("questions").objects().map { q ->
                        QuestionResultInfo(
                            q.getString("id"), q.getString("type"),
                            q.optJSONArray("options")?.let { a -> List(a.length()) { i -> a.getString(i) } },
                            q.getString("text"), q.getString("answerKey"), q.getString("status"), q.getInt("tries"), q.getInt("earnedMinutes"),
                        )
                    },
                )
            },
        )
    }

    private fun profileJson(p: KidProfile) =
        JSONObject().put("name", p.name).put("grade", p.grade).put("minutesPerQuestion", p.minutesPerQuestion).put("dailyCapMinutes", p.dailyCapMinutes).put("uiStyle", p.uiStyle)

    suspend fun createKid(token: String, profile: KidProfile, pin: String): String =
        call("POST", "/api/parent/kids", token, JSONObject().put("profile", profileJson(profile)).put("pin", pin)).getString("id")

    suspend fun updateKid(token: String, id: String, profile: KidProfile, pin: String) {
        kidAction(token, id, JSONObject().put("action", "update").put("profile", profileJson(profile)).apply { if (pin.isNotEmpty()) put("pin", pin) })
    }

    suspend fun addRule(token: String, id: String, mode: String, days: Int, start: String, end: String) {
        kidAction(token, id, JSONObject().put("action", "add_rule").put("mode", mode).put("days", days).put("start", start).put("end", end))
    }

    suspend fun deleteRule(token: String, id: String, ruleId: String) {
        kidAction(token, id, JSONObject().put("action", "delete_rule").put("ruleId", ruleId))
    }

    /** A one-time code to type on the kid's phone. */
    suspend fun pairPhone(token: String, id: String): String =
        call("POST", "/api/parent/kids/$id", token, JSONObject().put("action", "pair_phone")).getString("code")

    /** Reads a worksheet photo and suggests questions; nothing is assigned yet. */
    suspend fun extractHomework(token: String, file: WorksheetFile, grade: Int): List<QuestionDraft> {
        val boundary = "----studyplan${System.currentTimeMillis()}"
        val body = multipartBody(boundary, mapOf("grade" to grade.toString()), listOf(FilePart("image", if (isPdf(file.contentType)) "worksheet.pdf" else "worksheet.jpg", file.contentType, file.bytes)))
        val j = raw("POST", "/api/parent/homework/extract", token, "multipart/form-data; boundary=$boundary", body, 120_000)
        return j.getJSONArray("questions").objects().map {
            QuestionDraft(
                text = it.getString("text"),
                type = it.getString("type"),
                options = it.optJSONArray("options")?.let { a -> List(a.length()) { i -> a.getString(i) } },
                answerKey = it.optString("suggestedAnswer", ""),
            )
        }
    }

    private fun homeworkJson(subject: String, drafts: List<QuestionDraft>): JSONObject {
        val questions = JSONArray()
        drafts.filter { it.include }.forEach {
            questions.put(
                JSONObject().put("text", it.text.trim()).put("type", it.type)
                    .put("options", if (it.type == "multiple_choice") JSONArray(it.options.orEmpty().map(String::trim)) else JSONObject.NULL)
                    .put("answerKey", it.answerKey.trim())
                    .apply { it.id?.let { id -> put("id", id) } },
            )
        }
        return JSONObject().put("subject", subject.trim()).put("questions", questions)
    }

    suspend fun assignHomework(token: String, kidId: String, subject: String, drafts: List<QuestionDraft>) {
        call("POST", "/api/parent/kids/$kidId/homework", token, homeworkJson(subject, drafts))
    }

    /** Saves changes to a set: edited questions keep their tries, new ones are added, ones left out are removed. */
    suspend fun updateHomework(token: String, kidId: String, setId: String, subject: String, drafts: List<QuestionDraft>) {
        call("PUT", "/api/parent/kids/$kidId/homework/$setId", token, homeworkJson(subject, drafts))
    }

    suspend fun deleteHomework(token: String, kidId: String, setId: String) {
        call("DELETE", "/api/parent/kids/$kidId/homework/$setId", token)
    }

    /** Asks the AI to read the stored photos and suggest which answers are right. */
    suspend fun askAi(token: String, paperId: String) {
        raw("POST", "/api/parent/papers/$paperId/ai", token, "application/json", "{}".toByteArray(), 120_000)
    }

    private fun JSONArray.objects(): List<JSONObject> = List(length()) { getJSONObject(it) }
}
