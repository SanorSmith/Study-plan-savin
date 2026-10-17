package com.studyplan.parent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.annotation.GraphicsMode.Mode

/**
 * Draws the parent app's question lists into app/build/screenshots so the layout can be looked at without a phone. Slow, so it
 * only runs with the environment variable SCREENSHOTS=1:
 *   SCREENSHOTS=1 ./gradlew :parent:testDebugUnitTest --tests "*ScreenshotTest*"
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w412dp-h915dp-xxhdpi")
class ScreenshotTest {
    @get:Rule
    val compose = createComposeRule()

    private val results = listOf(
        QuestionResultInfo("1", "numeric", null, "What is 7 x 8?", "56", "solved", 2, 5, listOf(TryInfo("54", false), TryInfo("56", true))),
        QuestionResultInfo("2", "multiple_choice", listOf("12", "15", "17", "21"), "Which of these numbers is a prime number between ten and twenty?", "17", "failed", 3, 0, listOf(TryInfo("15", false), TryInfo("21", false), TryInfo("12", false))),
        QuestionResultInfo("3", "numeric", null, "Share 24 sweets equally between 6 children. How many does each child get?", "4", "not_tried", 0, 0),
    )

    private fun draw(name: String, content: @Composable () -> Unit) {
        assumeTrue("set SCREENSHOTS=1 to draw the screens", System.getenv("SCREENSHOTS") == "1")
        compose.setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF0F766E), onPrimary = Color.White, background = Color(0xFFF6FAF9), surface = Color.White, secondaryContainer = Color(0xFFCCFBF1), onSecondaryContainer = Color(0xFF134E4A))) {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
                }
            }
        }
        compose.onRoot().captureRoboImage("build/screenshots/$name.png")
    }

    @Test
    fun results() = draw("results") { results.forEachIndexed { i, q -> QuestionResultCard(i, q) } }

    @Test
    fun editing() = draw("editing") {
        DraftCard(0, QuestionDraft("What is 7 x 8?", "numeric", null, "56", true, "a"), {})
        DraftCard(1, QuestionDraft("Which of these numbers is a prime number between ten and twenty?", "multiple_choice", listOf("12", "15", "17", "21"), "17", true, "b"), {})
        DraftCard(2, QuestionDraft("Share 24 sweets equally between 6 children.", "numeric", null, "4", false, "c"), {})
    }
}
