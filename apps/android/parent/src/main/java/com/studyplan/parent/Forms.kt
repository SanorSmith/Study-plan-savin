package com.studyplan.parent

/** A question suggested from a worksheet photo that the parent can edit before it is assigned. */
data class QuestionDraft(
    val text: String,
    val type: String, // multiple_choice | numeric | short_text
    val options: List<String>?,
    val answerKey: String,
    val include: Boolean = true,
    val id: String? = null, // set when the question already exists and is being edited
)

/** The same rules the server applies, so the parent sees the problem before sending. Null means fine. */
fun validateDraft(d: QuestionDraft): String? {
    if (d.text.isBlank()) return "A question has no text"
    if (d.answerKey.isBlank()) return "\"${d.text.take(30)}\" needs an answer"
    if (d.type == "multiple_choice") {
        val options = d.options.orEmpty()
        if (options.size < 2) return "\"${d.text.take(30)}\" needs at least 2 options"
        if (d.answerKey.trim() !in options.map { it.trim() }) return "The answer to \"${d.text.take(30)}\" must be one of the options"
    }
    if (d.type == "numeric" && d.answerKey.trim().replace(',', '.').toDoubleOrNull() == null) return "The answer to \"${d.text.take(30)}\" must be a number"
    return null
}

/** Why the worksheet cannot be assigned yet, or null. Only the questions marked "include" count. */
fun validateHomework(subject: String, drafts: List<QuestionDraft>): String? {
    if (subject.isBlank()) return "Write the subject, for example Math"
    val chosen = drafts.filter { it.include }
    if (chosen.isEmpty()) return "Keep at least one question"
    if (chosen.size > 100) return "At most 100 questions"
    return chosen.firstNotNullOfOrNull(::validateDraft)
}

/** Same checks as the website's kid form. */
fun validateKid(name: String, grade: String, perQuestion: String, cap: String, pin: String, pinRequired: Boolean): String? {
    if (name.isBlank()) return "Write the kid's name"
    if ((grade.toIntOrNull() ?: 0) !in 1..12) return "Grade must be 1 to 12"
    if ((perQuestion.toIntOrNull() ?: 0) !in 1..60) return "Minutes per answer must be 1 to 60"
    if ((cap.toIntOrNull() ?: 0) !in 10..480) return "The daily limit must be 10 to 480 minutes"
    if (pin.isEmpty() && pinRequired) return "Choose a 4-digit PIN"
    if (pin.isNotEmpty() && !(pin.length == 4 && pin.all(Char::isDigit))) return "The PIN must be 4 digits"
    return null
}

val DAY_NAMES = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

/** Day numbers 0 (Monday) to 6 (Sunday) as the bit mask the server uses. */
fun daysMask(days: Set<Int>): Int = days.filter { it in 0..6 }.fold(0) { m, d -> m or (1 shl d) }

fun daysLabel(mask: Int): String = when (mask) {
    127 -> "Every day"
    0b0011111 -> "Mon to Fri"
    0b1100000 -> "Sat and Sun"
    else -> DAY_NAMES.filterIndexed { i, _ -> mask and (1 shl i) != 0 }.joinToString(", ")
}

fun formatMinute(total: Int): String = "%02d:%02d".format(total / 60, total % 60)

/** "21:00" or "9:30" to minutes after midnight, or null if it is not a time. */
fun parseTime(text: String): Int? {
    val m = Regex("^([01]?\\d|2[0-3]):([0-5]\\d)$").matchEntire(text.trim()) ?: return null
    return m.groupValues[1].toInt() * 60 + m.groupValues[2].toInt()
}

fun validateRule(days: Set<Int>, start: String, end: String): String? {
    if (days.isEmpty()) return "Pick at least one day"
    val s = parseTime(start) ?: return "Start time looks like 21:00"
    val e = parseTime(end) ?: return "End time looks like 07:00"
    if (s == e) return "Start and end must differ"
    return null
}

fun ruleLabel(mode: String, days: Int, start: Int, end: Int): String =
    "${if (mode == "blocked") "Locked" else "Free"} ${formatMinute(start)} to ${formatMinute(end)}, ${daysLabel(days)}"

fun statusLabel(status: String): String = when (status) {
    "solved" -> "Solved"
    "in_progress" -> "In progress"
    "failed" -> "Out of tries"
    else -> "Not tried"
}

fun styleLabel(style: String): String = when (style) {
    "little" -> "Young (grades 1 to 3)"
    "middle" -> "Middle (grades 4 to 6)"
    "teen" -> "Teen (grades 7 to 12)"
    else -> "Automatic from the grade"
}

/** Options typed as "a, b, c" (or one per line) to a clean list. */
fun parseOptions(text: String): List<String> = text.split(',', '\n').map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(8)

/** A blank question to fill in by hand. */
fun blankDraft(type: String) = QuestionDraft("", type, if (type == "multiple_choice") emptyList() else null, "")

fun typeLabel(type: String): String = when (type) {
    "multiple_choice" -> "Choose one"
    "numeric" -> "Number"
    else -> "Short answer"
}
