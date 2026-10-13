package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Test

class TimeTest {
    @Test
    fun remainingIsMeasuredAgainstTheServerClock() {
        assertEquals(600_000L, remainingMs("2026-10-13T20:10:00.000Z", "2026-10-13T20:00:00.000Z"))
    }

    @Test
    fun expiredSessionHasNothingLeft() {
        assertEquals(0L, remainingMs("2026-10-13T20:00:00.000Z", "2026-10-13T20:05:00.000Z"))
    }
}
