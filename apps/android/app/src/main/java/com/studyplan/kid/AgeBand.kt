package com.studyplan.kid

/**
 * The look of the kid's app follows the kid's age. Grades give three bands; a parent can force one.
 * The web kid page uses the same rule (age-band.ts).
 */
enum class AgeBand(val key: String) {
    Little("little"), // grades 1 to 3
    Middle("middle"), // grades 4 to 6
    Teen("teen"), // grades 7 to 12
    ;

    companion object {
        fun fromKey(key: String?): AgeBand = entries.firstOrNull { it.key == key } ?: Middle
    }
}

fun ageBand(grade: Int, style: String): AgeBand = when (style) {
    "little" -> AgeBand.Little
    "middle" -> AgeBand.Middle
    "teen" -> AgeBand.Teen
    else -> when {
        grade <= 3 -> AgeBand.Little
        grade <= 6 -> AgeBand.Middle
        else -> AgeBand.Teen
    }
}

/** What the on-screen number pad does when a key is pressed. The decimal point is only allowed once. */
fun applyKey(current: String, key: String, maxLength: Int, allowDecimal: Boolean): String = when {
    key == "⌫" -> current.dropLast(1)
    key == "." -> if (allowDecimal && "." !in current && current.length < maxLength) (if (current.isEmpty()) "0." else "$current.") else current
    key.length == 1 && key[0].isDigit() -> if (current.length < maxLength) current + key else current
    else -> current
}
