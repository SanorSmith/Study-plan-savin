package com.studyplan.kid

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import kotlinx.coroutines.launch

enum class Screen { Loading, Pair, Pin, Home }

class StudyViewModel(app: Application) : AndroidViewModel(app) {
    var screen by mutableStateOf(Screen.Loading)
        private set
    var state by mutableStateOf<KidState?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var busy by mutableStateOf(false)
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
            } catch (e: IOException) {
                message = "No connection. Check the internet and try again."
                if (screen == Screen.Loading) screen = Screen.Home
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
        message = when {
            r.correct && r.earnedMinutes > 0 -> "Correct! +${r.earnedMinutes} minutes"
            r.correct -> "Correct! (daily limit reached, no more minutes today)"
            r.attemptsLeft > 0 -> "Not quite. Try again (${r.attemptsLeft} ${if (r.attemptsLeft == 1) "try" else "tries"} left)"
            else -> "Not quite. No minutes for this one."
        }
        loadState(t)
    }
}
