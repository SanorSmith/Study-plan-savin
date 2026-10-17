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
    val imageTypes: List<String>,
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

data class TryInfo(val answer: String, val correct: Boolean)

data class QuestionResultInfo(
    val id: String,
    val type: String,
    val options: List<String>?,
    val text: String,
    val answerKey: String,
    val status: String,
    val tries: Int,
    val earnedMinutes: Int,
    val attempts: List<TryInfo> = emptyList(),
    val label: String? = null, // the number on the paper
)

data class HomeworkInfo(val id: String, val subject: String, val kind: String, val createdAt: String, val solved: Int, val total: Int, val earnedMinutes: Int, val questions: List<QuestionResultInfo>)

/** A practice set sent to the kid: with them, or pulled back by the parent. */
data class PracticeSetInfo(val id: String, val subject: String, val withdrawn: Boolean, val total: Int, val solved: Int, val createdAt: String)

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
    val autoPractice: String,
    val autoPracticeSize: Int,
    val approvedForSettings: Boolean,
    val schedule: List<RuleInfo>,
    val phones: List<PhoneInfo>,
    val homework: List<HomeworkInfo>,
    val practice: List<PracticeSetInfo>,
)

data class KidProfile(val name: String, val grade: Int, val minutesPerQuestion: Int, val dailyCapMinutes: Int, val uiStyle: String)

/** A file picked for a worksheet: a photo (shrunk to a JPEG) or a PDF as it is. */
class WorksheetFile(val bytes: ByteArray, val contentType: String)

fun isPdf(mime: String?): Boolean = mime == "application/pdf"

/** Photos and PDFs together must fit in the server's 4.5 MB upload limit. */
fun uploadTooLarge(size: Int): Boolean = size > 4_000_000

data class SubjectStat(val subject: String, val questions: Int, val solved: Int, val failed: Int, val accuracy: Int?)

data class Totals(
    val questions: Int,
    val solved: Int,
    val failed: Int,
    val attempts: Int,
    val accuracy: Int?,
    val firstTryRate: Int?,
    val earnedMinutes: Int,
    val papersChecked: Int,
)

data class TrendPoint(val label: String, val attempts: Int, val accuracy: Int?)

data class HardQuestion(val text: String, val subject: String, val answerKey: String, val tries: Int, val solved: Boolean, val wrongAnswers: List<String>)

data class StatsInfo(val period: String, val totals: Totals, val subjects: List<SubjectStat>, val trend: List<TrendPoint>, val hardest: List<HardQuestion>)

/** What the AI said about a kid: where they are strong, where they struggle, and what to do. */
data class AssessmentInfo(
    val summary: String,
    val strengths: List<Pair<String, String>>,
    val weaknesses: List<Pair<String, String>>,
    val recommendations: List<String>,
    val encouragement: String,
    val practiceFocus: List<String>,
)

data class ReportInfo(val id: String, val period: String, val createdAt: String, val accuracy: Int?, val assessment: AssessmentInfo?)

data class PerformanceData(val stats: StatsInfo, val reports: List<ReportInfo>)

/** How a percentage reads: good from 80, fair from 55, otherwise needs practice. */
fun levelOf(accuracy: Int?): String = when {
    accuracy == null -> "none"
    accuracy >= 80 -> "good"
    accuracy >= 55 -> "fair"
    else -> "low"
}

fun periodLabel(period: String): String = when (period) {
    "month" -> "Last 30 days"
    "year" -> "Last year"
    else -> "Last 7 days"
}

/** How often the AI may send practice by itself. */
val AUTO_MODES = listOf("off", "daily", "every_other_day", "weekly")

fun autoLabel(mode: String): String = when (mode) {
    "daily" -> "Every day"
    "every_other_day" -> "Every other day"
    "weekly" -> "Once a week"
    else -> "Off"
}

/** Practice questions made by the AI, before the parent has checked them. */
data class PracticeDraft(val subject: String, val questions: List<QuestionDraft>)
