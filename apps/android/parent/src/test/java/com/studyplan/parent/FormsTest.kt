package com.studyplan.parent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class FormsTest {
    private fun numeric(key: String, text: String = "2+2?") = QuestionDraft(text, "numeric", null, key)
    private fun choice(key: String, options: List<String>) = QuestionDraft("Pick one", "multiple_choice", options, key)

    @Test
    fun aGoodNumericQuestionPasses() {
        assertNull(validateDraft(numeric("4")))
        assertNull(validateDraft(numeric("3,5")))
    }

    @Test
    fun aNumericKeyMustBeANumber() {
        assertNotNull(validateDraft(numeric("four")))
    }

    @Test
    fun aChoiceKeyMustBeOneOfTheOptions() {
        assertNull(validateDraft(choice("b", listOf("a", "b"))))
        assertNotNull(validateDraft(choice("c", listOf("a", "b"))))
        assertNotNull(validateDraft(choice("a", listOf("a"))))
    }

    @Test
    fun aMissingAnswerOrTextIsRefused() {
        assertNotNull(validateDraft(numeric(" ")))
        assertNotNull(validateDraft(QuestionDraft(" ", "short_text", null, "x")))
    }

    @Test
    fun onlyIncludedQuestionsAreChecked() {
        val bad = numeric("x").copy(include = false)
        assertNull(validateHomework("Math", listOf(numeric("4"), bad)))
        assertNotNull(validateHomework("Math", listOf(bad)))
        assertNotNull(validateHomework("", listOf(numeric("4"))))
    }

    @Test
    fun kidFormFollowsTheWebsiteRules() {
        assertNull(validateKid("Mia", "4", "10", "120", "1234", pinRequired = true))
        assertNotNull(validateKid("", "4", "10", "120", "1234", true))
        assertNotNull(validateKid("Mia", "13", "10", "120", "1234", true))
        assertNotNull(validateKid("Mia", "4", "0", "120", "1234", true))
        assertNotNull(validateKid("Mia", "4", "10", "5", "1234", true))
        assertNotNull(validateKid("Mia", "4", "10", "120", "", pinRequired = true))
        assertNull(validateKid("Mia", "4", "10", "120", "", pinRequired = false))
        assertNotNull(validateKid("Mia", "4", "10", "120", "12a4", false))
    }

    @Test
    fun daysBecomeABitMaskAndBackToWords() {
        assertEquals(0b0011111, daysMask(setOf(0, 1, 2, 3, 4)))
        assertEquals("Mon to Fri", daysLabel(31))
        assertEquals("Sat and Sun", daysLabel(daysMask(setOf(5, 6))))
        assertEquals("Every day", daysLabel(127))
        assertEquals("Mon, Wed", daysLabel(daysMask(setOf(0, 2))))
        assertEquals(0, daysMask(setOf(9)))
    }

    @Test
    fun timesParseAndFormat() {
        assertEquals(1260, parseTime("21:00"))
        assertEquals(570, parseTime("9:30"))
        assertNull(parseTime("25:00"))
        assertNull(parseTime("9.30"))
        assertEquals("07:05", formatMinute(425))
    }

    @Test
    fun aRuleNeedsDaysAndDifferentTimes() {
        assertNull(validateRule(setOf(0), "21:00", "07:00"))
        assertNotNull(validateRule(emptySet(), "21:00", "07:00"))
        assertNotNull(validateRule(setOf(0), "21:00", "21:00"))
        assertNotNull(validateRule(setOf(0), "nine", "07:00"))
    }

    @Test
    fun aRuleReadsLikeASentence() {
        assertEquals("Locked 21:00 to 07:00, Mon to Fri", ruleLabel("blocked", 31, 1260, 420))
        assertEquals("Free 15:00 to 17:00, Sat and Sun", ruleLabel("free", 96, 900, 1020))
    }
}
