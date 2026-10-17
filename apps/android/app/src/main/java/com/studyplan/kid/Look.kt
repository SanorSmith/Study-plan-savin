package com.studyplan.kid

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * How the app looks and feels for one age band. Everything is bright and colorful, with as little text as possible
 * (explanations hide behind a tap). Little kids get big, colorful and playful; teens get cleaner, with no emoji,
 * but still light and colorful. There is no dark mode.
 */
data class Look(
    val band: AgeBand,
    val scheme: ColorScheme,
    val corner: Dp,
    val textScale: Float,
    val emoji: Boolean,
    val bigKeypad: Boolean, // numeric answers use an on-screen number pad
    val pageStart: Color, // the top of the page gradient
    val pageEnd: Color,
    val hero: List<Color>, // the big colored card with the time ring
    val options: List<Color>, // one color per answer choice
    val optionText: List<Color>,
)

val LocalLook = staticCompositionLocalOf { Looks.of(AgeBand.Middle) }

object Looks {
    fun of(band: AgeBand): Look = when (band) {
        AgeBand.Little -> Look(
            band = band,
            scheme = lightColorScheme(
                primary = Color(0xFF7C3AED),
                onPrimary = Color.White,
                primaryContainer = Color(0xFFEDE7FF),
                onPrimaryContainer = Color(0xFF3B1FA8),
                secondary = Color(0xFFFFB703),
                onSecondary = Color(0xFF1F1B3A),
                secondaryContainer = Color(0xFFFFE9A8),
                tertiary = Color(0xFF06A77D),
                background = Color(0xFFFFF3D6),
                onBackground = Color(0xFF1F1B3A),
                surface = Color.White,
                onSurface = Color(0xFF1F1B3A),
                surfaceVariant = Color(0xFFF3EEFF),
                error = Color(0xFFEF476F),
            ),
            corner = 28.dp,
            textScale = 1.3f,
            emoji = true,
            bigKeypad = true,
            pageStart = Color(0xFFFDE68A),
            pageEnd = Color(0xFFBAE6FD),
            hero = listOf(Color(0xFFD946EF), Color(0xFF8B5CF6), Color(0xFF0EA5E9)),
            options = listOf(Color(0xFFEF476F), Color(0xFF118AB2), Color(0xFF06A77D), Color(0xFFFFB703)),
            optionText = listOf(Color.White, Color.White, Color.White, Color(0xFF1F1B3A)),
        )
        AgeBand.Middle -> Look(
            band = band,
            scheme = lightColorScheme(
                primary = Color(0xFF4F46E5),
                onPrimary = Color.White,
                primaryContainer = Color(0xFFE0E7FF),
                onPrimaryContainer = Color(0xFF312E81),
                secondary = Color(0xFF0EA5E9),
                background = Color(0xFFECFEFF),
                onBackground = Color(0xFF0F172A),
                surface = Color.White,
                onSurface = Color(0xFF0F172A),
                surfaceVariant = Color(0xFFEEF2FF),
                error = Color(0xFFE11D48),
            ),
            corner = 24.dp,
            textScale = 1.1f,
            emoji = true,
            bigKeypad = false,
            pageStart = Color(0xFFCFFAFE),
            pageEnd = Color(0xFFFAE8FF),
            hero = listOf(Color(0xFF6366F1), Color(0xFF0EA5E9), Color(0xFF22D3EE)),
            options = listOf(Color(0xFFE0F2FE), Color(0xFFFCE7F3), Color(0xFFECFCCB), Color(0xFFFEF3C7)),
            optionText = listOf(Color(0xFF0C4A6E), Color(0xFF831843), Color(0xFF365314), Color(0xFF78350F)),
        )
        AgeBand.Teen -> Look(
            band = band,
            scheme = lightColorScheme(
                primary = Color(0xFF7C3AED),
                onPrimary = Color.White,
                primaryContainer = Color(0xFFEDE9FE),
                onPrimaryContainer = Color(0xFF4C1D95),
                secondary = Color(0xFFC026D3),
                background = Color(0xFFF5F3FF),
                onBackground = Color(0xFF0F172A),
                surface = Color.White,
                onSurface = Color(0xFF0F172A),
                surfaceVariant = Color(0xFFF5F3FF),
                error = Color(0xFFE11D48),
            ),
            corner = 18.dp,
            textScale = 1f,
            emoji = false,
            bigKeypad = false,
            pageStart = Color(0xFFEDE9FE),
            pageEnd = Color(0xFFCCFBF1),
            hero = listOf(Color(0xFF7C3AED), Color(0xFFC026D3), Color(0xFFF97316)),
            options = listOf(Color(0xFF7C3AED), Color(0xFFC026D3), Color(0xFFF97316), Color(0xFF0D9488)),
            optionText = listOf(Color(0xFF0F172A), Color(0xFF0F172A), Color(0xFF0F172A), Color(0xFF0F172A)),
        )
    }
}

private fun TextStyle.scaled(factor: Float) = copy(fontSize = fontSize * factor, lineHeight = lineHeight * factor)

private fun Typography.scaled(factor: Float) = Typography(
    displayLarge = displayLarge.scaled(factor),
    displayMedium = displayMedium.scaled(factor),
    displaySmall = displaySmall.scaled(factor),
    headlineLarge = headlineLarge.scaled(factor),
    headlineMedium = headlineMedium.scaled(factor),
    headlineSmall = headlineSmall.scaled(factor),
    titleLarge = titleLarge.scaled(factor),
    titleMedium = titleMedium.scaled(factor),
    titleSmall = titleSmall.scaled(factor),
    bodyLarge = bodyLarge.scaled(factor),
    bodyMedium = bodyMedium.scaled(factor),
    bodySmall = bodySmall.scaled(factor),
    labelLarge = labelLarge.scaled(factor),
    labelMedium = labelMedium.scaled(factor),
    labelSmall = labelSmall.scaled(factor),
)

/** Applies the look for [band]: colors, shapes and text size. Always the bright look, whatever the phone's theme. */
@Composable
fun StudyTheme(band: AgeBand, content: @Composable () -> Unit) {
    val look = Looks.of(band)
    val shapes = Shapes(
        small = RoundedCornerShape(look.corner * 0.5f),
        medium = RoundedCornerShape(look.corner * 0.75f),
        large = RoundedCornerShape(look.corner),
        extraLarge = RoundedCornerShape(look.corner * 1.25f),
    )
    CompositionLocalProvider(LocalLook provides look) {
        MaterialTheme(colorScheme = look.scheme, typography = MaterialTheme.typography.scaled(look.textScale), shapes = shapes, content = content)
    }
}

/** The words of the app for one age band: simple and cheerful for little kids, short and plain for teens. As few as possible. */
data class Copy(
    val hi: (String) -> String,
    val minutes: String,
    val info: String, // the one explanation, shown only when the kid taps the ? button
    val allDone: String,
    val noHomework: String,
    val correct: (Int) -> String,
    val correctNoMinutes: String,
    val tryAgain: (Int) -> String,
    val wrongFinal: String,
    val answer: String,
    val gotIt: String,
    val solvedOf: (Int, Int) -> String,
    val missedTitle: String,
    val rightAnswer: String,
    val askParent: String,
    val checkNew: String,
    val locked: (String) -> String,
    val free: (String) -> String,
    val pairTitle: String,
    val pairHint: String,
    val pinTitle: String,
    val celebrateEmoji: String,
)

object Copies {
    fun of(band: AgeBand): Copy = when (band) {
        AgeBand.Little -> Copy(
            hi = { "Hi $it! 👋" },
            minutes = "minutes",
            info = "Your play time counts down while you use other apps. Answer questions to get more! ⭐",
            allDone = "All done! 🎉",
            noHomework = "No homework. Time to play! 🎈",
            correct = { m -> if (m > 0) "Yay! 🎉 +$m" else "Yay! 🎉" },
            correctNoMinutes = "Yay! 🎉 That's all for today!",
            tryAgain = { n -> "Oops! Try again 💪 " + "❤️".repeat(n.coerceIn(0, 3)) },
            wrongFinal = "Next one! 🌈",
            answer = "Done ✅",
            gotIt = "Got it! 👍",
            solvedOf = { s, t -> "$s of $t right ⭐" },
            missedTitle = "Let's learn these 💡",
            rightAnswer = "Right answer",
            askParent = "Want to try again? Ask a grown-up! 👪",
            checkNew = "Look for new homework 🔄",
            locked = { "🌙 Back at $it" },
            free = { "🎈 Free play until $it" },
            pairTitle = "Let's connect! 🔗",
            pairHint = "Ask a grown-up for the code",
            pinTitle = "Secret number 🔒",
            celebrateEmoji = "🎉 ⭐ 🎈",
        )
        AgeBand.Middle -> Copy(
            hi = { "Hi $it" },
            minutes = "min",
            info = "Minutes are used while you use other apps. Answer questions to earn more.",
            allDone = "All done! ⭐",
            noHomework = "No homework right now",
            correct = { m -> if (m > 0) "Correct! +$m" else "Correct!" },
            correctNoMinutes = "Correct! Daily limit reached",
            tryAgain = { n -> "Not quite. $n ${if (n == 1) "try" else "tries"} left" },
            wrongFinal = "Not this time",
            answer = "Answer",
            gotIt = "Got it",
            solvedOf = { s, t -> "$s of $t right" },
            missedTitle = "To learn from",
            rightAnswer = "Right answer",
            askParent = "Want another try? Ask a parent to reopen it.",
            checkNew = "Look for new homework",
            locked = { "Locked until $it" },
            free = { "Free time until $it" },
            pairTitle = "Connect",
            pairHint = "Ask a parent for the code",
            pinTitle = "Your PIN",
            celebrateEmoji = "⭐",
        )
        AgeBand.Teen -> Copy(
            hi = { it },
            minutes = "min",
            info = "Minutes are used while the screen is on and another app is open. Answer questions to earn more.",
            allDone = "All done",
            noHomework = "No homework",
            correct = { m -> if (m > 0) "Correct +$m min" else "Correct" },
            correctNoMinutes = "Correct. Daily limit reached",
            tryAgain = { n -> "Incorrect. $n left" },
            wrongFinal = "Incorrect",
            answer = "Submit",
            gotIt = "OK",
            solvedOf = { s, t -> "$s of $t solved" },
            missedTitle = "Missed",
            rightAnswer = "Answer",
            askParent = "A parent can reopen these for another try.",
            checkNew = "Check for new homework",
            locked = { "Locked until $it" },
            free = { "Free until $it" },
            pairTitle = "Connect",
            pairHint = "Code from your parent",
            pinTitle = "PIN",
            celebrateEmoji = "",
        )
    }
}

/** The text on the lock cover and lock screen, by age band and reason. */
data class LockText(val title: String, val body: String, val button: String)

fun lockText(band: AgeBand, reason: LockReason, untilMinute: Int?): LockText {
    val until = untilMinute?.let(::formatMinute)
    return when (reason) {
        LockReason.Protected -> when (band) {
            AgeBand.Little -> LockText("Ask a grown-up 🔒", "Settings are for grown-ups.", "Grown-up PIN")
            else -> LockText("Parents only", "Settings and uninstalling need a parent.", "Enter parent PIN")
        }
        LockReason.Scheduled -> when (band) {
            AgeBand.Little -> LockText("Sleepy time 🌙", if (until != null) "Come back at $until." else "Come back later.", "Open Study Plan")
            AgeBand.Middle -> LockText("Phone is off", if (until != null) "Locked until $until." else "Locked for now.", "Open Study Plan")
            AgeBand.Teen -> LockText("Locked", if (until != null) "Back at $until." else "Locked for now.", "Open Study Plan")
        }
        LockReason.NoCredit -> when (band) {
            AgeBand.Little -> LockText("Time's up! ⏰", "Do your homework to win more play time 🌟", "Let's go! 🚀")
            AgeBand.Middle -> LockText("Homework first", "Answer homework questions to earn screen time.", "Open Study Plan")
            AgeBand.Teen -> LockText("Screen time is up", "Answer homework questions to earn more.", "Open Study Plan")
        }
    }
}
