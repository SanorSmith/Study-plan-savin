package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Test

class AgeBandTest {
    @Test
    fun followsTheGradeWhenAutomatic() {
        assertEquals(AgeBand.Little, ageBand(1, "auto"))
        assertEquals(AgeBand.Little, ageBand(3, "auto"))
        assertEquals(AgeBand.Middle, ageBand(4, "auto"))
        assertEquals(AgeBand.Middle, ageBand(6, "auto"))
        assertEquals(AgeBand.Teen, ageBand(7, "auto"))
        assertEquals(AgeBand.Teen, ageBand(12, "auto"))
    }

    @Test
    fun aParentCanForceAStyle() {
        assertEquals(AgeBand.Little, ageBand(9, "little"))
        assertEquals(AgeBand.Teen, ageBand(1, "teen"))
        assertEquals(AgeBand.Middle, ageBand(2, "middle"))
    }

    @Test
    fun anUnknownStyleFallsBackToTheGrade() {
        assertEquals(AgeBand.Little, ageBand(2, "robot"))
        assertEquals(AgeBand.Teen, ageBand(8, ""))
    }

    @Test
    fun savedKeysComeBackAndUnknownOnesMeanMiddle() {
        for (band in AgeBand.entries) assertEquals(band, AgeBand.fromKey(band.key))
        assertEquals(AgeBand.Middle, AgeBand.fromKey(null))
        assertEquals(AgeBand.Middle, AgeBand.fromKey("nope"))
    }

    @Test
    fun keypadAddsDigitsAndDeletes() {
        assertEquals("5", applyKey("", "5", 8, false))
        assertEquals("56", applyKey("5", "6", 8, false))
        assertEquals("5", applyKey("56", "⌫", 8, false))
        assertEquals("", applyKey("", "⌫", 8, false))
    }

    @Test
    fun keypadStopsAtTheMaximumLength() {
        assertEquals("1234", applyKey("1234", "5", 4, false))
        assertEquals("1234", applyKey("123", "4", 4, false))
    }

    @Test
    fun keypadAllowsOneDecimalPointOnlyWhenAsked() {
        assertEquals("3.", applyKey("3", ".", 8, true))
        assertEquals("3.5", applyKey("3.", "5", 8, true))
        assertEquals("3.5", applyKey("3.5", ".", 8, true)) // a second point is ignored
        assertEquals("0.", applyKey("", ".", 8, true)) // a leading point gets a zero
        assertEquals("3", applyKey("3", ".", 8, false)) // not allowed for a PIN
    }
}
