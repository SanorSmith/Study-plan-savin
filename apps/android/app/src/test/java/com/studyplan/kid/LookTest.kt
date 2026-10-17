package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LookTest {
    @Test
    fun youngKidsGetBigPlayfulLooksAndTeensGetPlainOnes() {
        val little = Looks.of(AgeBand.Little)
        val teen = Looks.of(AgeBand.Teen)
        assertTrue(little.emoji && little.bigKeypad)
        assertFalse(teen.emoji || teen.bigKeypad)
        assertTrue(little.textScale > Looks.of(AgeBand.Middle).textScale)
        assertTrue(Looks.of(AgeBand.Middle).textScale > teen.textScale)
        assertTrue(little.corner > teen.corner)
    }

    @Test
    fun everyLookIsBrightNeverDark() {
        for (band in AgeBand.values()) {
            val look = Looks.of(band)
            val bg = look.scheme.background
            // a dark page would have a low brightness in every channel
            assertTrue("$band background is too dark", bg.red + bg.green + bg.blue > 2.2f)
            assertEquals(3, look.hero.size)
            assertEquals(4, look.options.size)
        }
    }

    @Test
    fun answerChoicesGetDifferentColors() {
        for (band in AgeBand.values()) assertEquals(4, Looks.of(band).options.toSet().size)
    }

    @Test
    fun wordsFitTheAge() {
        assertEquals("Hi Maja! 👋", Copies.of(AgeBand.Little).hi("Maja"))
        assertEquals("Hi Maja", Copies.of(AgeBand.Middle).hi("Maja"))
        assertEquals("Maja", Copies.of(AgeBand.Teen).hi("Maja"))
        assertEquals("Yay! 🎉 +10", Copies.of(AgeBand.Little).correct(10))
        assertEquals("Correct +10 min", Copies.of(AgeBand.Teen).correct(10))
        assertEquals("Oops! Try again 💪 ❤️", Copies.of(AgeBand.Little).tryAgain(1))
        assertEquals("Incorrect. 2 left", Copies.of(AgeBand.Teen).tryAgain(2))
    }

    @Test
    fun noEmojiForTeens() {
        val teen = Copies.of(AgeBand.Teen)
        assertEquals("", teen.celebrateEmoji)
        assertFalse(teen.allDone.any { it.code > 0x2000 })
    }

    @Test
    fun lockTextFollowsReasonAndAge() {
        assertEquals("Time's up! ⏰", lockText(AgeBand.Little, LockReason.NoCredit, null).title)
        assertEquals("Homework first", lockText(AgeBand.Middle, LockReason.NoCredit, null).title)
        assertEquals("Locked until 07:00.", lockText(AgeBand.Middle, LockReason.Scheduled, 420).body)
        assertEquals("Come back at 07:00.", lockText(AgeBand.Little, LockReason.Scheduled, 420).body)
        assertEquals("Parents only", lockText(AgeBand.Teen, LockReason.Protected, null).title)
        assertEquals("Ask a grown-up 🔒", lockText(AgeBand.Little, LockReason.Protected, null).title)
    }
}

class WordsAreShortTest {
    @Test
    fun feedbackStaysShort() {
        for (band in AgeBand.values()) {
            val c = Copies.of(band)
            assertTrue(c.correct(10).length <= 20)
            assertTrue(c.tryAgain(2).length <= 30)
            assertTrue(c.allDone.length <= 15)
            assertTrue(c.noHomework.length <= 30)
        }
    }

    @Test
    fun theAllDoneScreenSaysHowItWent() {
        assertEquals("3 of 4 right ⭐", Copies.of(AgeBand.Little).solvedOf(3, 4))
        assertEquals("3 of 4 solved", Copies.of(AgeBand.Teen).solvedOf(3, 4))
        for (band in AgeBand.values()) {
            val c = Copies.of(band)
            assertTrue(c.askParent.isNotBlank() && c.rightAnswer.isNotBlank() && c.checkNew.isNotBlank() && c.missedTitle.isNotBlank())
        }
    }
}
