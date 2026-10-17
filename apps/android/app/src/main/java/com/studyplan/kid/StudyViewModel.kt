package com.studyplan.kid

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class Screen { Loading, Pair, Pin, Home }

enum class Tone { Good, Info, Bad }

/** What to tell the kid about the last answer, in the words of their age band. */
data class Feedback(val text: String, val tone: Tone)

/** The pop-up burst shown for a short moment after a right answer. */
data class Celebration(val emoji: String, val text: String)

class StudyViewModel(app: Application) : AndroidViewModel(app) {
    var screen by mutableStateOf(Screen.Loading)
        private set
    var state by mutableStateOf<KidState?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var busy by mutableStateOf(false)
        private set
    var band by mutableStateOf(Store.band(app))
        private set
    var feedback by mutableStateOf<Feedback?>(null)
        private set
    var celebration by mutableStateOf<Celebration?>(null)
        private set

    private val ctx get() = getApplication<Application>()
    private val token get() = Store.token(ctx)

    init {
        refresh()
    }

    fun refresh() {
        val t = token
        if (t == null) {
            screen = Screen.Pair
            return
        }
        run { loadState(t) }
    }

    private suspend fun loadState(t: String) {
        UsageSync.run(ctx, refresh = false) // flush screen time used so far, so the balance below is current
        val s = Api.state(t)
        UsageSync.apply(ctx, s.balanceMinutes, s.serverNow, s.schedule, s.approvedUntil)
        state = s
        band = ageBand(s.grade, s.uiStyle)
        Store.setBand(ctx, band)
        screen = Screen.Home
    }

    /** Runs an API call, turning failures into screen changes or a message for the kid. */
    private fun run(block: suspend () -> Unit) {
        viewModelScope.launch {
            busy = true
            try {
                block()
            } catch (e: ApiException) {
                when (e.status) {
                    401 -> {
                        // This device is no longer paired (a parent removed it).
                        if (token != null) Store.setToken(ctx, null)
                        screen = Screen.Pair
                        message = null
                    }
                    403 -> if (e.message == "PIN required") screen = Screen.Pin else message = e.message
                    else -> message = e.message
                }
            } catch (e: org.json.JSONException) {
                message = "The server sent something unexpected. Try again later."
            } catch (e: CancellationException) {
                throw e
            } catch (e: IOException) {
                message = "No connection. Check the internet and try again."
                if (screen == Screen.Loading) screen = Screen.Home
            } catch (e: Exception) {
                message = "Something went wrong. Try again."
            } finally {
                busy = false
            }
        }
    }

    fun clearMessage() {
        message = null
    }

    fun pair(code: String) = run {
        message = null
        Store.setToken(ctx, Api.pair(code.trim().uppercase()))
        screen = Screen.Pin
    }

    fun unlock(pin: String) = run {
        message = null
        val t = token ?: return@run
        Api.unlock(t, pin)
        loadState(t)
    }

    fun answer(question: Question, value: String) = run {
        val t = token ?: return@run
        val r = Api.answer(t, question.id, value)
        val copy = Copies.of(band)
        val fb = when {
            r.correct && r.earnedMinutes > 0 -> Feedback(copy.correct(r.earnedMinutes), Tone.Good)
            r.correct -> Feedback(copy.correctNoMinutes, Tone.Info)
            r.attemptsLeft > 0 -> Feedback(copy.tryAgain(r.attemptsLeft), Tone.Bad)
            else -> Feedback(copy.wrongFinal, Tone.Bad)
        }
        feedback = fb
        celebration = if (r.correct && copy.celebrateEmoji.isNotEmpty()) Celebration(copy.celebrateEmoji, fb.text) else null
        loadState(t)
        if (celebration != null) {
            viewModelScope.launch {
                delay(1_700)
                celebration = null
            }
        }
    }

    /** Sends photos of the finished paper. With mode "ai" the minutes are added at once; with "parent" a parent checks it. */
    fun readMessages(ids: List<String>) = run {
        val t = token ?: return@run
        Api.readMessages(t, ids)
        loadState(t)
    }

    fun sendPaper(setId: String, photos: List<Uri>, mode: String, onSent: () -> Unit) = run {
        message = null
        val t = token ?: return@run
        val files = withContext(Dispatchers.IO) { photos.mapIndexed { i, uri -> PaperFiles.read(ctx, uri, i) } }
        if (PaperFiles.tooLarge(files.map { it.bytes.size })) throw ApiException(413, "The files are too big. Use a smaller PDF or fewer pages.")
        val result = Api.uploadPaper(t, setId, files, mode)
        message = if (result.checkedByAi) {
            "The AI checked your paper: ${result.correct} of ${result.total} correct. " +
                if (result.minutes > 0) "+${result.minutes} minutes!" else "No new minutes this time."
        } else {
            "Sent! A parent will check it, then your minutes arrive."
        }
        onSent()
        withContext(Dispatchers.IO) { ctx.cacheDir.resolve("paper").listFiles()?.forEach { it.delete() } }
        if (result.checkedByAi) loadState(t) // the bank changed
    }
}
