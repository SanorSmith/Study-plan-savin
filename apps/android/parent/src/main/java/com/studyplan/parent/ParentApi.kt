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

    private fun JSONArray.objects(): List<JSONObject> = List(length()) { getJSONObject(it) }
}
