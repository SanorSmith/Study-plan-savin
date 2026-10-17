package com.studyplan.kid

import android.app.Application
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.annotation.GraphicsMode.Mode

/**
 * Draws the kid's real home screen for each age and question type into app/build/screenshots, so the layout can be looked at
 * without a phone. Slow, so it only runs with the environment variable SCREENSHOTS=1:
 *   SCREENSHOTS=1 ./gradlew :app:testDebugUnitTest --tests "*ScreenshotTest*"
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w412dp-h915dp-xxhdpi")
class ScreenshotTest {
    @get:Rule
    val compose = createComposeRule()

    private fun state(question: Question?, messages: List<KidMessage> = emptyList(), review: Review? = null) = KidState(
        serverNow = "2026-10-17T12:00:00Z",
        name = "Mia",
        balanceMinutes = 34,
        minutesPerQuestion = 10,
        earnableTodayMinutes = 60,
        question = question,
        schedule = Schedule.None,
        approvedUntil = null,
        paperSets = listOf(PaperSet("s1", "Math")),
        aiCheckEnabled = false,
        grade = 4,
        uiStyle = "auto",
        progress = if (question != null) Progress(1, 4) else null,
        messages = messages,
        review = review,
    )

    private val numeric = Question("q1", "What is 7 x 8?", "numeric", null, "Math")
    private val shortChoice = Question("q2", "Which is a prime number?", "multiple_choice", listOf("9", "15", "13", "21"), "Math")
    private val longChoice = Question(
        "q3",
        "Which sentence uses a comma correctly when the speaker is listing three different things they bought?",
        "multiple_choice",
        listOf(
            "I bought apples, oranges and bananas at the market yesterday",
            "I bought, apples oranges, and bananas at the market yesterday",
            "I bought apples oranges and bananas, at the market yesterday afternoon",
        ),
        "Swedish",
    )

    private fun shot(name: String, band: AgeBand, s: KidState, fontScale: Float = 1f) {
        assumeTrue("set SCREENSHOTS=1 to draw the screens", System.getenv("SCREENSHOTS") == "1")
        RuntimeEnvironment.setFontScale(fontScale)
        val vm = StudyViewModel(ApplicationProvider.getApplicationContext<Application>())
        vm.showForPreview(s, band)
        compose.setContent {
            StudyTheme(band) {
                PageBackground {
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) { HomeScreen(vm, s) }
                }
            }
        }
        compose.onRoot().captureRoboImage("build/screenshots/$name.png")
    }

    @Test
    fun little_numeric() = shot("little_numeric", AgeBand.Little, state(numeric))

    @Test
    fun little_choice_short() = shot("little_choice_short", AgeBand.Little, state(shortChoice))

    @Test
    fun little_choice_long() = shot("little_choice_long", AgeBand.Little, state(longChoice))

    @Test
    fun middle_choice_long() = shot("middle_choice_long", AgeBand.Middle, state(longChoice))

    @Test
    fun middle_numeric() = shot("middle_numeric", AgeBand.Middle, state(numeric))

    @Test
    fun teen_choice_long() = shot("teen_choice_long", AgeBand.Teen, state(longChoice))

    @Test
    fun teen_numeric() = shot("teen_numeric", AgeBand.Teen, state(numeric, listOf(KidMessage("m1", "result", "Math: 3 of 4 right. +20 min. Great job!"))))

    @Test
    fun little_all_done() =
        shot("little_all_done", AgeBand.Little, state(null, review = Review(4, 2, listOf(Missed("What is 3/4 + 1/4?", "1"), Missed("What is 12 / 4?", "3")))))

    // Small phones and big system fonts, which is what makes layouts break
    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun small_little_choice_big_font() = shot("small_little_choice_big_font", AgeBand.Little, state(shortChoice), fontScale = 1.4f)

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun small_little_numeric_big_font() = shot("small_little_numeric_big_font", AgeBand.Little, state(numeric), fontScale = 1.4f)

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun small_middle_long_big_font() = shot("small_middle_long_big_font", AgeBand.Middle, state(longChoice), fontScale = 1.4f)

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun small_teen_numeric_big_font() = shot("small_teen_numeric_big_font", AgeBand.Teen, state(numeric), fontScale = 1.4f)

    @Test
    fun little_choice_short_normal() = shot("little_choice_short_normal", AgeBand.Little, state(shortChoice))

    @Test
    @Config(qualifiers = "w360dp-h640dp-xhdpi")
    fun small_long_subject() =
        shot("small_long_subject", AgeBand.Little, state(Question("q9", "What is 2 + 2?", "numeric", null, "Mathematics and problem solving")), fontScale = 1.3f)

    @Test
    fun long_subject_normal() = shot("long_subject_normal", AgeBand.Middle, state(Question("q9", "What is 2 + 2?", "numeric", null, "Mathematics and problem solving")))
}
