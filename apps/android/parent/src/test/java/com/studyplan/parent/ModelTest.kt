package com.studyplan.parent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelTest {
    private fun paper(id: String, kid: String = "Alvin", subject: String = "Math") = PaperItem(id, "k-$kid", kid, subject, "2026-10-15T10:00:00Z")

    private fun answer(id: String, aiCorrect: Boolean = false, solved: Boolean = false) =
        PaperAnswer(id, "Q $id", "4", "4", aiCorrect, true, null, solved, null)

    @Test
    fun onlyPapersNotSeenBeforeAreNew() {
        val fresh = newPapers(setOf("a"), listOf(paper("a"), paper("b")))
        assertEquals(listOf("b"), fresh.map { it.id })
    }

    @Test
    fun nothingIsNewWhenAllWereSeen() {
        assertTrue(newPapers(setOf("a", "b"), listOf(paper("a"), paper("b"))).isEmpty())
    }

    @Test
    fun oneNewPaperNamesTheKidAndSubject() {
        val (title, text) = notificationText(listOf(paper("a", "Alvin", "Science")))
        assertEquals("Alvin sent a paper", title)
        assertTrue(text.startsWith("Science"))
    }

    @Test
    fun severalPapersAreCountedAndKidsListedOnce() {
        val (title, text) = notificationText(listOf(paper("a", "Alvin"), paper("b", "Alvin"), paper("c", "Mia")))
        assertEquals("3 papers to check", title)
        assertTrue(text.contains("Alvin, Mia"))
    }

    @Test
    fun reviewStartsWithTheAiTicksOnlyWhenTheAiRead() {
        val answers = listOf(answer("1", aiCorrect = true), answer("2"), answer("3", aiCorrect = true, solved = true))
        assertEquals(setOf("1"), startingTicks(answers, aiRead = true))
        assertTrue(startingTicks(answers, aiRead = false).isEmpty())
    }

    @Test
    fun solvedQuestionsCannotBeDecided() {
        val answers = listOf(answer("1"), answer("2", solved = true))
        assertEquals(listOf("1"), decidable(answers).map { it.questionId })
    }

    @Test
    fun minutesAreWrittenInSingularAndPlural() {
        assertEquals("1 minute", minutesLabel(1))
        assertEquals("0 minutes", minutesLabel(0))
        assertEquals("15 minutes", minutesLabel(15))
    }

    @Test
    fun codesAreCleanedUp() {
        assertEquals("ABCD2345", cleanCode(" abcd-2345 "))
        assertEquals("ABCD2345", cleanCode("abcd2345xyz"))
        assertFalse(cleanCode("--").isNotEmpty())
    }

    @Test
    fun pdfsAreRecognised() {
        assertTrue(isPdf("application/pdf"))
        assertFalse(isPdf("image/jpeg"))
        assertFalse(isPdf(null))
    }

    @Test
    fun uploadsOverFourMegabytesAreRefused() {
        assertFalse(uploadTooLarge(3_999_999))
        assertTrue(uploadTooLarge(4_000_001))
    }

    @Test
    fun pdfPagesKeepTheirShape() {
        assertEquals(1500 to 2123, PdfPages.pageSize(595, 842))
        assertEquals(1500 to 1500, PdfPages.pageSize(0, 0))
    }
}
