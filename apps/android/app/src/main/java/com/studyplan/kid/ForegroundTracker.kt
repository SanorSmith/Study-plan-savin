package com.studyplan.kid

/**
 * Follows which app is in front from Android's usage events (package names only, never what is on screen).
 * An app that is resumed becomes the current one; when it is paused and nothing else resumed, no app is in front.
 */
class ForegroundTracker {
    var current: String? = null
        private set

    fun apply(eventType: Int, pkg: String) {
        when (eventType) {
            RESUMED -> current = pkg
            PAUSED -> if (current == pkg) current = null
        }
    }

    companion object {
        // UsageEvents.Event.ACTIVITY_RESUMED / ACTIVITY_PAUSED (the same values as the older MOVE_TO_FOREGROUND / MOVE_TO_BACKGROUND).
        const val RESUMED = 1
        const val PAUSED = 2
    }
}
