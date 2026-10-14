package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ForegroundTrackerTest {
    private val R = ForegroundTracker.RESUMED
    private val P = ForegroundTracker.PAUSED

    @Test
    fun startsWithNoApp() {
        assertNull(ForegroundTracker().current)
    }

    @Test
    fun resumedAppIsInFront() {
        val t = ForegroundTracker()
        t.apply(R, "com.game")
        assertEquals("com.game", t.current)
    }

    @Test
    fun switchingAppsFollowsTheLatestResume() {
        val t = ForegroundTracker()
        t.apply(R, "com.game")
        t.apply(P, "com.game")
        t.apply(R, "com.video")
        assertEquals("com.video", t.current)
    }

    @Test
    fun pauseWithNothingResumedMeansNoApp() {
        val t = ForegroundTracker()
        t.apply(R, "com.game")
        t.apply(P, "com.game")
        assertNull(t.current)
    }

    @Test
    fun aLatePauseOfTheOldAppDoesNotHideTheNewOne() {
        val t = ForegroundTracker()
        t.apply(R, "com.game")
        t.apply(R, "com.video") // new app resumed first
        t.apply(P, "com.game") // old app's pause arrives afterwards
        assertEquals("com.video", t.current)
    }

    @Test
    fun otherEventTypesAreIgnored() {
        val t = ForegroundTracker()
        t.apply(R, "com.game")
        t.apply(23, "com.game") // ACTIVITY_STOPPED
        assertEquals("com.game", t.current)
    }
}
