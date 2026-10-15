package com.studyplan.kid

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** How the app looks and feels for one age band. Little kids get big, colorful and playful; teens get clean and compact. */
data class Look(
    val band: AgeBand,
    val scheme: ColorScheme,
    val corner: Dp,
    val textScale: Float,
    val emoji: Boolean,
    val bigKeypad: Boolean, // numeric answers use an on-screen number pad
    val pageStart: Color, // the top of the page gradient
    val pageEnd: Color,
)

val LocalLook = staticCompositionLocalOf { Looks.of(AgeBand.Middle, dark = false) }

/** Colors for the little kids' multiple choice buttons, one per option. */
val OptionColors = listOf(Color(0xFFEF476F), Color(0xFF118AB2), Color(0xFF06A77D), Color(0xFFFFB703))

object Looks {
    fun of(band: AgeBand, dark: Boolean): Look = when (band) {
        AgeBand.Little -> Look(
            band = band,
            scheme = lightColorScheme(
                primary = Color(0xFF6C4CF1),
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
            pageStart = Color(0xFFFFE9A8),
            pageEnd = Color(0xFFD9F0FF),
        )
        AgeBand.Middle -> Look(
            band = band,
            scheme = lightColorScheme(
                primary = Color(0xFF4F46E5),
                onPrimary = Color.White,
                primaryContainer = Color(0xFFE0E7FF),
                onPrimaryContainer = Color(0xFF312E81),
                secondary = Color(0xFF0EA5E9),
                background = Color(0xFFEEF2FF),
                onBackground = Color(0xFF0F172A),
                surface = Color.White,
                onSurface = Color(0xFF0F172A),
                surfaceVariant = Color(0xFFEEF2FF),
                error = Color(0xFFE11D48),
            ),
            corner = 20.dp,
            textScale = 1.1f,
            emoji = true,
            bigKeypad = false,
            pageStart = Color(0xFFE0F2FE),
            pageEnd = Color(0xFFE0E7FF),
        )
        AgeBand.Teen -> if (dark) {
            Look(
                band = band,
                scheme = darkColorScheme(
                    primary = Color(0xFFF1F5F9),
                    onPrimary = Color(0xFF0F172A),
                    primaryContainer = Color(0xFF1E293B),
                    onPrimaryContainer = Color(0xFFF1F5F9),
                    background = Color(0xFF020617),
                    onBackground = Color(0xFFF1F5F9),
                    surface = Color(0xFF0F172A),
                    onSurface = Color(0xFFF1F5F9),
                    surfaceVariant = Color(0xFF1E293B),
                    error = Color(0xFFFB7185),
                ),
                corner = 12.dp,
                textScale = 1f,
                emoji = false,
                bigKeypad = false,
                pageStart = Color(0xFF020617),
                pageEnd = Color(0xFF020617),
            )
        } else {
            Look(
                band = band,
                scheme = lightColorScheme(
                    primary = Color(0xFF0F172A),
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFE2E8F0),
                    onPrimaryContainer = Color(0xFF0F172A),
                    background = Color(0xFFF8FAFC),
                    onBackground = Color(0xFF0F172A),
                    surface = Color.White,
                    onSurface = Color(0xFF0F172A),
                    surfaceVariant = Color(0xFFF1F5F9),
                    error = Color(0xFFE11D48),
                ),
                corner = 12.dp,
                textScale = 1f,
                emoji = false,
                bigKeypad = false,
                pageStart = Color(0xFFF8FAFC),
                pageEnd = Color(0xFFF8FAFC),
            )
        }
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

/** Applies the look for [band]: colors, shapes and text size. Teens follow the phone's dark mode; younger kids always get the bright look. */
@Composable
fun StudyTheme(band: AgeBand, content: @Composable () -> Unit) {
    val look = Looks.of(band, dark = band == AgeBand.Teen && isSystemInDarkTheme())
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

/** The words of the app for one age band: simple and cheerful for little kids, short and plain for teens. */
data class Copy(
    val hi: (String) -> String,
    val bank: String,
    val minutes: String,
    val yourTurn: String,
    val allDone: String,
    val noHomework: String,
    val correct: (Int) -> String,
    val correctNoMinutes: String,
    val tryAgain: (Int) -> String,
    val wrongFinal: String,
    val answer: String,
    val locked: (String) -> String,
    val free: (String) -> String,
    val automatic: String,
    val pairTitle: String,
    val pairHint: String,
    val pinTitle: String,
    val celebrateEmoji: String,
)

object Copies {
    fun of(band: AgeBand): Copy = when (band) {
        AgeBand.Little -> Copy(
            hi = { "Hi $it! 👋" },
            bank = "Your play time",
            minutes = "minutes",
            yourTurn = "Your turn! ⭐",
            allDone = "All done! 🎉 You finished your homework!",
            noHomework = "No homework right now. Time to play! 🎈",
            correct = { m -> if (m > 0) "Yay! You got it! 🎉 +$m minutes" else "Yay! You got it! 🎉" },
            correctNoMinutes = "Yay! Right! 🎉 That is all the play time for today.",
            tryAgain = { n -> "Oops! Try again 💪 ($n ${if (n == 1) "try" else "tries"} left)" },
            wrongFinal = "Not this time. On to the next one! 🌈",
            answer = "Done ✅",
            locked = { "Sleepy time 🌙 Back at $it" },
            free = { "Free play until $it! 🎈" },
            automatic = "Your play time counts down while you use other apps.",
            pairTitle = "Let's connect! 🔗",
            pairHint = "Ask a grown-up for the code.",
            pinTitle = "What is your secret number? 🔒",
            celebrateEmoji = "🎉 ⭐ 🎈",
        )
        AgeBand.Middle -> Copy(
            hi = { "Hi $it" },
            bank = "Screen time bank",
            minutes = "min",
            yourTurn = "Next question",
            allDone = "All done! ⭐ Nice work on your homework.",
            noHomework = "No homework waiting. Ask a parent to add some.",
            correct = { m -> if (m > 0) "Correct! +$m minutes" else "Correct!" },
            correctNoMinutes = "Correct! You have reached today's limit, so no more minutes today.",
            tryAgain = { n -> "Not quite. Try again ($n ${if (n == 1) "try" else "tries"} left)." },
            wrongFinal = "Not quite. No minutes for this one.",
            answer = "Answer",
            locked = { "The phone is locked until $it." },
            free = { "Free time until $it. No minutes are used." },
            automatic = "Minutes are used automatically while you use other apps.",
            pairTitle = "Connect this device",
            pairHint = "Ask a parent for the pairing code.",
            pinTitle = "Enter your PIN",
            celebrateEmoji = "⭐",
        )
        AgeBand.Teen -> Copy(
            hi = { it },
            bank = "Screen time left",
            minutes = "min",
            yourTurn = "Question",
            allDone = "All done for now.",
            noHomework = "No homework waiting.",
            correct = { m -> if (m > 0) "Correct. +$m min" else "Correct" },
            correctNoMinutes = "Correct. Daily limit reached, no more minutes today.",
            tryAgain = { n -> "Incorrect. $n ${if (n == 1) "try" else "tries"} left." },
            wrongFinal = "Incorrect. No minutes for this one.",
            answer = "Submit",
            locked = { "Locked until $it." },
            free = { "Free time until $it. No minutes used." },
            automatic = "Minutes are used while the screen is on and another app is open.",
            pairTitle = "Connect device",
            pairHint = "Enter the pairing code from your parent.",
            pinTitle = "Enter PIN",
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
