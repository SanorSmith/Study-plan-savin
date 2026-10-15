package com.studyplan.parent

data class KidSummary(
    val id: String,
    val name: String,
    val grade: Int,
    val balanceMinutes: Int,
    val pairedPhones: Int,
    val aiCheckEnabled: Boolean,
    val approvedForSettings: Boolean,
    val papersToReview: Int,
)

data class PaperItem(val id: String, val kidId: String, val kidName: String, val subject: String, val createdAt: String)

data class ParentState(val kids: List<KidSummary>, val papers: List<PaperItem>)

data class PaperAnswer(
    val questionId: String,
    val text: String,
    val answerKey: String,
    val readAnswer: String?,
    val aiCorrect: Boolean,
    val legible: Boolean,
    val note: String?,
    val alreadySolved: Boolean,
    val finalCorrect: Boolean?,
)

data class PaperDetail(
    val id: String,
    val kidName: String,
    val subject: String,
    val status: String,
    val mode: String,
    val aiRead: Boolean,
    val autoApproved: Boolean,
    val awardedMinutes: Int,
    val imageCount: Int,
    val answers: List<PaperAnswer>,
)

data class ActionResult(val changedMinutes: Int, val balanceMinutes: Int)

data class DecisionResult(val awardedMinutes: Int, val correctCount: Int, val total: Int)

/** Papers that are waiting now and were not there the last time we looked. */
fun newPapers(seen: Set<String>, current: List<PaperItem>): List<PaperItem> = current.filter { it.id !in seen }

/** The notification for papers that just arrived: who sent them and for which homework. */
fun notificationText(fresh: List<PaperItem>): Pair<String, String> {
    require(fresh.isNotEmpty())
    return if (fresh.size == 1) {
        val p = fresh[0]
        "${p.kidName} sent a paper" to "${p.subject}: open the app to check it"
    } else {
        val names = fresh.map { it.kidName }.distinct()
        "${fresh.size} papers to check" to "From ${names.joinToString(", ")}. Open the app to check them"
    }
}

/** Where the review starts: the questions the AI marked right (only if it read the paper) and that the kid had not already solved. */
fun startingTicks(answers: List<PaperAnswer>, aiRead: Boolean): Set<String> =
    answers.filter { aiRead && it.aiCorrect && !it.alreadySolved }.map { it.questionId }.toSet()

/** Questions the parent can still decide on. */
fun decidable(answers: List<PaperAnswer>): List<PaperAnswer> = answers.filter { !it.alreadySolved }

fun minutesLabel(minutes: Int): String = if (minutes == 1) "1 minute" else "$minutes minutes"

fun gradeLabel(grade: Int): String = "Grade $grade"

/** A code typed by hand: letters and digits only, upper case, at most 8 characters. */
fun cleanCode(raw: String): String = raw.uppercase().filter { it.isLetterOrDigit() }.take(8)

data class RuleInfo(val id: String, val mode: String, val days: Int, val startMinute: Int, val endMinute: Int)

data class PhoneInfo(val id: String, val platform: String, val paired: Boolean, val code: String?)

data class QuestionResultInfo(val text: String, val answerKey: String, val status: String, val tries: Int, val earnedMinutes: Int)

data class HomeworkInfo(val id: String, val subject: String, val createdAt: String, val solved: Int, val total: Int, val earnedMinutes: Int, val questions: List<QuestionResultInfo>)

data class KidDetail(
    val id: String,
    val name: String,
    val grade: Int,
    val minutesPerQuestion: Int,
    val dailyCapMinutes: Int,
    val uiStyle: String,
    val hasPin: Boolean,
    val balanceMinutes: Int,
    val earnedTodayMinutes: Int,
    val aiCheckEnabled: Boolean,
    val approvedForSettings: Boolean,
    val schedule: List<RuleInfo>,
    val phones: List<PhoneInfo>,
    val homework: List<HomeworkInfo>,
)

data class KidProfile(val name: String, val grade: Int, val minutesPerQuestion: Int, val dailyCapMinutes: Int, val uiStyle: String)
