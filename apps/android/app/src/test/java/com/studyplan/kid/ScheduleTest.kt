package com.studyplan.kid

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ScheduleTest {
    private val tz = "Europe/Stockholm"
    private val everyDay = 127
    private val monToFri = 0b0011111

    // 2026-10-13 is a Tuesday
    private fun at(day: Int, hour: Int, minute: Int): Long =
        ZonedDateTime.of(2026, 10, day, hour, minute, 0, 0, ZoneId.of(tz)).toInstant().toEpochMilli()

    private fun schedule(vararg rules: Rule) = Schedule(tz, rules.toList())

    @Test
    fun noRulesMeansNoWindow() {
        assertNull(activeWindow(Schedule.None, at(13, 12, 0)))
    }

    @Test
    fun daytimeWindowCoversItsHoursOnly() {
        val s = schedule(Rule("blocked", monToFri, 8 * 60, 15 * 60))
        assertEquals(Mode.Blocked, activeWindow(s, at(13, 9, 0))?.mode) // Tuesday
        assertNull(activeWindow(s, at(13, 15, 0))) // end is exclusive
        assertNull(activeWindow(s, at(17, 9, 0))) // Saturday
    }

    @Test
    fun overnightWindowRunsPastMidnightIntoTheNextDay() {
        val s = schedule(Rule("blocked", monToFri, 21 * 60, 7 * 60))
        assertEquals(Mode.Blocked, activeWindow(s, at(13, 22, 0))?.mode) // Tue 22:00
        assertEquals(Mode.Blocked, activeWindow(s, at(14, 6, 59))?.mode) // Wed 06:59, started Tuesday
        assertNull(activeWindow(s, at(14, 7, 0)))
        assertNull(activeWindow(s, at(17, 22, 0))) // Saturday night is not in the days
        assertEquals(Mode.Blocked, activeWindow(s, at(17, 6, 0))?.mode) // Sat 06:00 started Friday night
    }

    @Test
    fun blockedBeatsFree() {
        val s = schedule(
            Rule("free", everyDay, 0, 23 * 60),
            Rule("blocked", everyDay, 12 * 60, 13 * 60),
        )
        assertEquals(Mode.Blocked, activeWindow(s, at(13, 12, 30))?.mode)
        assertEquals(Mode.Free, activeWindow(s, at(13, 14, 0))?.mode)
    }

    @Test
    fun usesTheScheduleTimezoneNotTheDevices() {
        val s = Schedule("Asia/Tokyo", listOf(Rule("blocked", everyDay, 9 * 60, 10 * 60)))
        // 09:30 in Tokyo is 02:30 in Stockholm (CEST) on the same date.
        assertEquals(Mode.Blocked, activeWindow(s, at(13, 2, 30))?.mode)
    }

    @Test
    fun decisionsFollowTheRules() {
        val blocked = Window(Mode.Blocked, 420)
        val free = Window(Mode.Free, 600)
        assertEquals(Decision.Allow, decide(true, true, blocked, 0)) // allowed apps are never blocked
        assertEquals(Decision.Allow, decide(false, false, blocked, 0)) // not paired: never lock
        assertEquals(Decision.Lock(LockReason.Scheduled, 420), decide(true, false, blocked, 9999))
        assertEquals(Decision.Allow, decide(true, false, free, 0))
        assertEquals(Decision.Consume, decide(true, false, null, 1))
        assertEquals(Decision.Lock(LockReason.NoCredit, null), decide(true, false, null, 0))
    }

    @Test
    fun formatsMinutes() {
        assertEquals("07:05", formatMinute(425))
    }
}
