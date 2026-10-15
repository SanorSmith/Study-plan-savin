package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LookTest {
    @Test
    fun youngKidsGetBigPlayfulLooksAndTeensGetPlainOnes() {
        val little = Looks.of(AgeBand.Little, dark = false)
        val teen = Looks.of(AgeBand.Teen, dark = false)
        assertTrue(little.emoji && little.bigKeypad)
        assertFalse(teen.emoji || teen.bigKeypad)
        assertTrue(little.textScale > Looks.of(AgeBand.Middle, false).textScale)
        assertTrue(Looks.of(AgeBand.Middle, false).textScale > teen.textScale)
        assertTrue(little.corner > teen.corner)
    }

    @Test
    fun onlyTeensGetADarkLook() {
        val light = Looks.of(AgeBand.Teen, dark = false).scheme.background
        val dark = Looks.of(AgeBand.Teen, dark = true).scheme.background
        assertNotEquals(light, dark)
        // asking for dark does nothing for younger kids
        assertEquals(Looks.of(AgeBand.Little, false).scheme.background, Looks.of(AgeBand.Little, true).scheme.background)
    }

    @Test
    fun wordsFitTheAge() {
        assertEquals("Hi Maja! 👋", Copies.of(AgeBand.Little).hi("Maja"))
        assertEquals("Hi Maja", Copies.of(AgeBand.Middle).hi("Maja"))
        assertEquals("Maja", Copies.of(AgeBand.Teen).hi("Maja"))
        assertEquals("Yay! You got it! 🎉 +10 minutes", Copies.of(AgeBand.Little).correct(10))
        assertEquals("Correct. +10 min", Copies.of(AgeBand.Teen).correct(10))
        assertEquals("Oops! Try again 💪 (1 try left)", Copies.of(AgeBand.Little).tryAgain(1))
        assertEquals("Incorrect. 2 tries left.", Copies.of(AgeBand.Teen).tryAgain(2))
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
