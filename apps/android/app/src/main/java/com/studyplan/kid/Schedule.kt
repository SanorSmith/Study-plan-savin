package com.studyplan.kid

import java.time.Instant
import java.time.ZoneId

/** One parent-set window. `days` is a bitmask (Monday = 1 ... Sunday = 64); an end before the start runs past midnight. */
data class Rule(val mode: String, val days: Int, val startMinute: Int, val endMinute: Int)

data class Schedule(val timezone: String, val rules: List<Rule>) {
    companion object {
        val None = Schedule("UTC", emptyList())
    }
}

enum class Mode { Free, Blocked }

/** The window that applies right now and the minute of the day it ends. */
data class Window(val mode: Mode, val endMinute: Int)

/** Blocked beats Free; null means no window applies and credit is used as normal. */
fun activeWindow(schedule: Schedule, nowMs: Long): Window? {
    val zone = runCatching { ZoneId.of(schedule.timezone) }.getOrDefault(ZoneId.of("UTC"))
    val z = Instant.ofEpochMilli(nowMs).atZone(zone)
    val minute = z.hour * 60 + z.minute
    val today = 1 shl (z.dayOfWeek.value - 1)
    val yesterday = 1 shl ((z.dayOfWeek.value + 5) % 7)

    var free: Window? = null
    for (r in schedule.rules) {
        val active = if (r.startMinute < r.endMinute) {
            r.days and today != 0 && minute in r.startMinute until r.endMinute
        } else {
            (r.days and today != 0 && minute >= r.startMinute) || (r.days and yesterday != 0 && minute < r.endMinute)
        }
        if (!active) continue
        if (r.mode == "blocked") return Window(Mode.Blocked, r.endMinute)
        free = Window(Mode.Free, r.endMinute)
    }
    return free
}

enum class LockReason { Scheduled, NoCredit, Protected }

sealed interface Decision {
    data object Allow : Decision
    data object Consume : Decision
    data class Lock(val reason: LockReason, val untilMinute: Int?) : Decision
}

/**
 * What to do about the app in front, once per second while the screen is on.
 * Study Plan, the home screen, the dialer and system UI are never blocked or charged.
 * Settings and the uninstall screens are parents-only until a parent approves them.
 */
fun decide(
    paired: Boolean,
    allowedApp: Boolean,
    protectedApp: Boolean,
    approved: Boolean,
    window: Window?,
    remainingSec: Long,
): Decision = when {
    !paired -> Decision.Allow
    protectedApp -> if (approved) Decision.Allow else Decision.Lock(LockReason.Protected, null)
    allowedApp -> Decision.Allow
    window?.mode == Mode.Blocked -> Decision.Lock(LockReason.Scheduled, window.endMinute)
    window?.mode == Mode.Free -> Decision.Allow
    remainingSec > 0 -> Decision.Consume
    else -> Decision.Lock(LockReason.NoCredit, null)
}

fun formatMinute(total: Int): String = "%02d:%02d".format(total / 60, total % 60)
