package com.studyplan.parent

import android.app.Application
import android.graphics.Bitmap
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
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
    data object AddKid : Screen
    data class EditKid(val id: String) : Screen
    data class Results(val id: String) : Screen
    data class NewHomework(val id: String) : Screen
    data class EditHomework(val id: String, val setId: String) : Screen
    data class Performance(val id: String) : Screen
    data class Practice(val id: String) : Screen
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
    var kid by mutableStateOf<KidDetail?>(null)
        private set
    var drafts by mutableStateOf<List<QuestionDraft>>(emptyList())
    var newCode by mutableStateOf<String?>(null)
        private set
    var performance by mutableStateOf<PerformanceData?>(null)
        private set
    var practiceSubject by mutableStateOf("")
    var period by mutableStateOf("week")
        private set
    /** Bumped when the AI changes the ticks of the open paper, so the screen starts again from them. */
    var paperVersion by mutableStateOf(0)
        private set

    var instantAlerts by mutableStateOf(Store.instantAlerts(app))
        private set

    fun turnInstantAlerts(on: Boolean) {
        Store.setInstantAlerts(getApplication(), on)
        instantAlerts = on
        if (on) AlertService.start(getApplication()) else AlertService.stop(getApplication())
    }

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
        AlertService.stop(getApplication())
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
        reloadKid(t)
    }

    /** Refreshes the open kid page (after a change, or when it is opened). */
    private suspend fun reloadKid(t: String) {
        val id = when (val s = screen) {
            is Screen.Kid -> s.id
            is Screen.Results -> s.id
            is Screen.EditKid -> s.id
            is Screen.EditHomework -> s.id
            is Screen.Practice -> s.id
            else -> return
        }
        kid = ParentApi.kid(t, id)
    }

    fun openKid(id: String) {
        clearMessages()
        newCode = null
        kid = null
        screen = Screen.Kid(id)
        run { t -> reloadKid(t) }
    }

    fun openResults(id: String) {
        clearMessages()
        screen = Screen.Results(id)
        run { t -> reloadKid(t) }
    }

    fun openPerformance(id: String, which: String = period) {
        clearMessages()
        period = which
        performance = null
        screen = Screen.Performance(id)
        run { t -> performance = ParentApi.performance(t, id, which) }
    }

    fun openPractice(id: String) {
        clearMessages()
        drafts = emptyList()
        practiceSubject = ""
        screen = Screen.Practice(id)
        run { t -> reloadKid(t) }
    }

    fun makePractice(id: String, count: Int, focus: List<String>) = run { t ->
        val made = ParentApi.practiceGenerate(t, id, period, count, focus)
        practiceSubject = made.subject
        drafts = made.questions
    }

    fun sendPractice(id: String) = run { t ->
        ParentApi.practiceSend(t, id, practiceSubject, drafts)
        drafts = emptyList()
        message = "Practice sent. ${kidNameOf(id)} sees it after the homework they already have."
        reloadKid(t)
    }

    private fun kidNameOf(id: String): String = kid?.takeIf { it.id == id }?.name ?: "The kid"

    fun saveAutoPractice(id: String, mode: String, size: Int) = run { t ->
        ParentApi.setAutoPractice(t, id, mode, size)
        message = if (mode == "off") "Automatic practice is off." else "The AI will send practice: ${autoLabel(mode).lowercase()}."
        reloadKid(t)
    }

    fun assess(id: String) = run { t ->
        ParentApi.assess(t, id, period)
        performance = ParentApi.performance(t, id, period)
        message = "The AI assessment is ready."
    }

    fun openEdit(id: String) {
        clearMessages()
        screen = Screen.EditKid(id)
        run { t -> reloadKid(t) }
    }

    fun openNewHomework(id: String) {
        clearMessages()
        drafts = emptyList()
        screen = Screen.NewHomework(id)
    }

    fun goHome() {
        clearMessages()
        paper = null
        newCode = null
        screen = Screen.Home
    }

    fun back() {
        when (val s = screen) {
            is Screen.EditHomework -> openResults(s.id)
            is Screen.Performance -> openKid(s.id)
            is Screen.Practice -> openPerformance(s.id)
            is Screen.Results, is Screen.EditKid, is Screen.NewHomework -> {
                val id = when (s) {
                    is Screen.Results -> s.id
                    is Screen.EditKid -> s.id
                    is Screen.NewHomework -> s.id
                    else -> ""
                }
                openKid(id)
            }
            else -> goHome()
        }
    }

    fun openEditHomework(kidId: String, set: HomeworkInfo) {
        clearMessages()
        drafts = set.questions.map { QuestionDraft(it.text, it.type, it.options, it.answerKey, true, it.id) }
        screen = Screen.EditHomework(kidId, set.id)
    }

    fun saveHomework(kidId: String, setId: String, subject: String) = run { t ->
        ParentApi.updateHomework(t, kidId, setId, subject, drafts)
        drafts = emptyList()
        message = "Homework saved."
        state = ParentApi.state(t)
        screen = Screen.Results(kidId)
        kid = ParentApi.kid(t, kidId)
    }

    fun deleteHomework(kidId: String, setId: String) = run { t ->
        ParentApi.deleteHomework(t, kidId, setId)
        message = "Homework removed. Minutes already earned stay in the bank."
        state = ParentApi.state(t)
        kid = ParentApi.kid(t, kidId)
    }

    fun createKid(profile: KidProfile, pin: String) = run { t ->
        val id = ParentApi.createKid(t, profile, pin)
        state = ParentApi.state(t)
        message = "${profile.name} was added. Pair their phone with a code."
        screen = Screen.Kid(id)
        kid = ParentApi.kid(t, id)
    }

    fun updateKid(id: String, profile: KidProfile, pin: String) = run { t ->
        ParentApi.updateKid(t, id, profile, pin)
        state = ParentApi.state(t)
        message = "Saved."
        screen = Screen.Kid(id)
        kid = ParentApi.kid(t, id)
    }

    fun addRule(id: String, mode: String, days: Int, start: String, end: String) = run { t ->
        ParentApi.addRule(t, id, mode, days, start, end)
        message = "Time window added."
        reloadKid(t)
    }

    fun deleteRule(id: String, ruleId: String) = run { t ->
        ParentApi.deleteRule(t, id, ruleId)
        message = "Time window removed."
        reloadKid(t)
    }

    fun pairPhone(id: String) = run { t ->
        newCode = ParentApi.pairPhone(t, id)
        reloadKid(t)
    }

    /** Sends a worksheet photo to be read; the suggested questions show up for editing. */
    fun readWorksheet(context: Context, uri: Uri, grade: Int) = run { t ->
        val file = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val mime = context.contentResolver.getType(uri)
            if (isPdf(mime)) WorksheetFile(context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Could not read the PDF"), "application/pdf")
            else WorksheetFile(ImageShrink.toJpeg(context, uri), "image/jpeg")
        }
        if (uploadTooLarge(file.bytes.size)) throw ApiException(413, "The file is too big (4 MB at most). Use fewer pages.")
        val found = ParentApi.extractHomework(t, file, grade)
        drafts = found
        if (found.isEmpty()) error = "No questions were found. Try a clearer, closer photo."
    }

    fun assignHomework(id: String, subject: String) = run { t ->
        ParentApi.assignHomework(t, id, subject, drafts)
        drafts = emptyList()
        message = "Homework assigned."
        state = ParentApi.state(t)
        screen = Screen.Results(id)
        kid = ParentApi.kid(t, id)
    }

    fun askAi(paperId: String) = run { t ->
        ParentApi.askAi(t, paperId)
        val detail = ParentApi.paper(t, paperId)
        paper = detail
        message = "The AI ticked what looks right. Check it against the photos."
        paperVersion += 1
    }

    fun pullBackPractice(kidId: String, set: PracticeSetInfo, pullBack: Boolean) =
        act(if (pullBack) "Pulled back. ${kidNameOf(kidId)} no longer sees ${set.subject}. You can send it again." else "Sent again. ${kidNameOf(kidId)} sees ${set.subject} again.") {
            ParentApi.pullBackPractice(it, kidId, set.id, pullBack)
        }

    fun retryMissed(kidId: String) = act("Done. {n} missed questions go back to the kid after their homework.") { ParentApi.retryMissed(it, kidId) }
    fun sendMessage(kidId: String, text: String) = act("Message sent.") { ParentApi.message(it, kidId, text) }
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
            var shown = emptyList<Bitmap?>()
            for (i in 0 until detail.imageCount) {
                val bytes = runCatching { ParentApi.image(t, id, i) }.getOrNull()
                val pages: List<Bitmap?> = when {
                    bytes == null -> listOf(null)
                    isPdf(detail.imageTypes.getOrNull(i)) -> runCatching { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) { PdfPages.render(getApplication(), bytes) } }.getOrDefault(emptyList())
                    else -> listOf(runCatching { decode(bytes) }.getOrNull())
                }
                shown = shown + pages
                photos = shown + List(maxOf(0, detail.imageCount - i - 1)) { null }
            }
            photos = shown
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

    fun decide(id: String, correct: Set<String>?, note: String = "", done: (String) -> Unit = {}) = run { t ->
        if (correct == null) {
            ParentApi.reject(t, id, note)
            message = "Paper sent back. No minutes added."
        } else {
            val r = ParentApi.approve(t, id, correct, note)
            message = "${r.correctCount} of ${r.total} counted. ${minutesLabel(r.awardedMinutes)} added."
        }
        state = ParentApi.state(t)
        Store.setSeenPapers(getApplication(), state!!.papers.map { it.id }.toSet())
        paper = null
        screen = Screen.Home
        done(id)
    }
}
