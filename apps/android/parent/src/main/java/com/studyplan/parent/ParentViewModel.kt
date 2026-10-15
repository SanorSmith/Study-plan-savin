package com.studyplan.parent

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.IOException
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Home : Screen
    data class Kid(val id: String) : Screen
    data class Paper(val id: String) : Screen
}

class ParentViewModel(app: Application) : AndroidViewModel(app) {
    var token by mutableStateOf(Store.token(app))
        private set
    var state by mutableStateOf<ParentState?>(null)
        private set
    var screen by mutableStateOf<Screen>(Screen.Home)
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var paper by mutableStateOf<PaperDetail?>(null)
        private set
    var photos by mutableStateOf<List<Bitmap?>>(emptyList())
        private set

    fun clearMessages() {
        message = null
        error = null
    }

    private fun friendly(e: Exception): String = when (e) {
        is ApiException -> e.message ?: "Something went wrong"
        is IOException -> "No connection. Check the internet and try again."
        else -> "Something went wrong. Try again."
    }

    /** Runs a call; a revoked token (401) signs the app out. */
    private fun run(block: suspend (String) -> Unit) {
        val t = token ?: return
        viewModelScope.launch {
            busy = true
            error = null
            try {
                block(t)
            } catch (e: ApiException) {
                if (e.status == 401) signOut("This phone was removed from your account. Pair it again.") else error = friendly(e)
            } catch (e: Exception) {
                error = friendly(e)
            } finally {
                busy = false
            }
        }
    }

    fun pair(code: String) {
        viewModelScope.launch {
            busy = true
            error = null
            try {
                val phone = listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.joinToString(" ")
                val t = ParentApi.pair(cleanCode(code), phone)
                Store.setToken(getApplication(), t)
                token = t
                // Papers already waiting are not "new": only tell about the ones that arrive from now on.
                runCatching { Store.setSeenPapers(getApplication(), ParentApi.state(t).papers.map { it.id }.toSet()) }
                Notifier.schedule(getApplication())
                refresh()
            } catch (e: Exception) {
                error = friendly(e)
            } finally {
                busy = false
            }
        }
    }

    fun signOut(why: String? = null) {
        Store.setToken(getApplication(), null)
        Notifier.cancel(getApplication())
        token = null
        state = null
        paper = null
        screen = Screen.Home
        error = why
    }

    fun refresh() = run { t ->
        state = ParentApi.state(t)
        Store.setSeenPapers(getApplication(), state!!.papers.map { it.id }.toSet())
    }

    private fun act(done: String, call: suspend (String) -> ActionResult) = run { t ->
        val r = call(t)
        message = done.replace("{n}", r.changedMinutes.toString())
        state = ParentApi.state(t)
    }

    fun bonus(kidId: String, minutes: Int) = act("Added ${minutesLabel(minutes)}.") { ParentApi.bonus(it, kidId, minutes) }
    fun withdraw(kidId: String, minutes: Int) = act("Took out {n} min.") { ParentApi.withdraw(it, kidId, minutes) }
    fun emptyBank(kidId: String) = act("Bank emptied ({n} min removed).") { ParentApi.emptyBank(it, kidId) }
    fun setAi(kidId: String, enabled: Boolean) = act(if (enabled) "The kid can now choose AI checking." else "Every paper now goes to you.") { ParentApi.setAi(it, kidId, enabled) }
    fun allowSettings(kidId: String, allow: Boolean) =
        act(if (allow) "Settings are open on the kid's phone for 10 minutes." else "Settings are closed again.") { ParentApi.allowSettings(it, kidId, allow) }

    fun openPaper(id: String) {
        paper = null
        photos = emptyList()
        screen = Screen.Paper(id)
        run { t ->
            val detail = ParentApi.paper(t, id)
            paper = detail
            photos = List(detail.imageCount) { null }
            for (i in 0 until detail.imageCount) {
                val bmp = runCatching { decode(ParentApi.image(t, id, i)) }.getOrNull()
                photos = photos.toMutableList().also { it[i] = bmp }
            }
        }
    }

    /** Decodes at a size that fits the screen so a 12 MP photo does not use all the memory. */
    private fun decode(bytes: ByteArray): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / sample > 2200) sample *= 2
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
    }

    fun decide(id: String, correct: Set<String>?, done: (String) -> Unit = {}) = run { t ->
        if (correct == null) {
            ParentApi.reject(t, id)
            message = "Paper sent back. No minutes added."
        } else {
            val r = ParentApi.approve(t, id, correct)
            message = "${r.correctCount} of ${r.total} counted. ${minutesLabel(r.awardedMinutes)} added."
        }
        state = ParentApi.state(t)
        Store.setSeenPapers(getApplication(), state!!.papers.map { it.id }.toSet())
        paper = null
        screen = Screen.Home
        done(id)
    }
}
