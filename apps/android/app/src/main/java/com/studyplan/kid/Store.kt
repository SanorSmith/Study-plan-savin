package com.studyplan.kid

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/** A usage report that has been taken off the pending seconds but not yet confirmed by the server. */
data class Inflight(val key: String, val minutes: Int)

/**
 * Device token plus the local copy of the kid's time bank, kept in app-private storage so the lock
 * service can decide offline.
 *
 * The bank is tracked in seconds:
 *   remaining = serverBalance - pending (not yet reported) - inflight (reported, not yet confirmed)
 * The server stays the source of truth; usage is reported in whole minutes with a retry-safe key.
 */
object Store {
    private val lock = Any()

    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences("studyplan", Context.MODE_PRIVATE)

    private fun bootCount(c: Context) = Settings.Global.getInt(c.contentResolver, Settings.Global.BOOT_COUNT, 0)

    fun token(c: Context): String? = prefs(c).getString("token", null)

    fun setToken(c: Context, token: String?) = synchronized(lock) {
        val e = prefs(c).edit()
        if (token == null) e.clear() else e.putString("token", token)
        e.apply()
    }

    // --- server clock: the phone's wall clock is not trusted -------------------------------------

    /** Server time, carried forward with the monotonic clock so changing the phone's date has no effect. */
    fun nowMs(c: Context): Long {
        val p = prefs(c)
        if (p.getInt("anchorBoot", -1) != bootCount(c)) return System.currentTimeMillis() // not synced since boot
        return p.getLong("anchorServerMs", 0) + (SystemClock.elapsedRealtime() - p.getLong("anchorElapsed", 0))
    }

    private fun anchor(c: Context, serverNow: String) {
        prefs(c).edit()
            .putLong("anchorServerMs", java.time.Instant.parse(serverNow).toEpochMilli())
            .putLong("anchorElapsed", SystemClock.elapsedRealtime())
            .putInt("anchorBoot", bootCount(c))
            .apply()
    }

    // --- bank ------------------------------------------------------------------------------------

    fun remainingSec(c: Context): Long = synchronized(lock) {
        val p = prefs(c)
        (p.getLong("balanceSec", 0) - p.getLong("pendingSec", 0) - p.getInt("inflightMin", 0) * 60L).coerceAtLeast(0)
    }

    /** Takes a fresh balance, schedule and clock from the server. */
    fun applySync(c: Context, balanceMinutes: Int, serverNow: String, schedule: Schedule, approvedUntil: String?) = synchronized(lock) {
        prefs(c).edit()
            .putLong("balanceSec", balanceMinutes * 60L)
            .putString("schedule", scheduleToJson(schedule))
            .putLong("approvedUntilMs", approvedUntil?.let { java.time.Instant.parse(it).toEpochMilli() } ?: 0)
            .apply()
        anchor(c, serverNow)
    }

    /** Takes only the schedule and clock, used while a usage report is unconfirmed and the balance would be ambiguous. */
    fun applyScheduleOnly(c: Context, serverNow: String, schedule: Schedule, approvedUntil: String?) = synchronized(lock) {
        prefs(c).edit()
            .putString("schedule", scheduleToJson(schedule))
            .putLong("approvedUntilMs", approvedUntil?.let { java.time.Instant.parse(it).toEpochMilli() } ?: 0)
            .apply()
        anchor(c, serverNow)
    }

    /** A parent typed their PIN: Settings and uninstall screens are open until then (server time). */
    fun setApproved(c: Context, approvedUntil: String, serverNow: String) = synchronized(lock) {
        prefs(c).edit().putLong("approvedUntilMs", java.time.Instant.parse(approvedUntil).toEpochMilli()).apply()
        anchor(c, serverNow)
    }

    fun isApproved(c: Context): Boolean = prefs(c).getLong("approvedUntilMs", 0) > nowMs(c)

    fun addUsage(c: Context, seconds: Long) = synchronized(lock) {
        val p = prefs(c)
        p.edit().putLong("pendingSec", p.getLong("pendingSec", 0) + seconds).apply()
    }

    fun pendingSec(c: Context): Long = prefs(c).getLong("pendingSec", 0)

    fun inflight(c: Context): Inflight? = synchronized(lock) {
        val p = prefs(c)
        val key = p.getString("inflightKey", null)
        val min = p.getInt("inflightMin", 0)
        if (key != null && min > 0) Inflight(key, min) else null
    }

    /** Moves whole pending minutes into a report with its own key, which survives a failed send. */
    fun startInflight(c: Context): Inflight? = synchronized(lock) {
        val p = prefs(c)
        val minutes = (p.getLong("pendingSec", 0) / 60).toInt()
        if (minutes < 1) return null
        val report = Inflight(UUID.randomUUID().toString(), minutes)
        p.edit()
            .putLong("pendingSec", p.getLong("pendingSec", 0) - minutes * 60L)
            .putString("inflightKey", report.key)
            .putInt("inflightMin", minutes)
            .apply()
        report
    }

    /** The server accepted the report; its balance already includes the charge. */
    fun finishInflight(c: Context, balanceMinutes: Int, serverNow: String) = synchronized(lock) {
        prefs(c).edit()
            .putLong("balanceSec", balanceMinutes * 60L)
            .remove("inflightKey")
            .remove("inflightMin")
            .apply()
        anchor(c, serverNow)
    }

    // --- camera allowance ----------------------------------------------------------------------

    /** The camera and photo picker are blocked apps like any other, so they are let through for a few minutes while a paper is photographed. */
    fun allowCameraFor(c: Context, ms: Long = 5 * 60_000L) {
        prefs(c).edit().putLong("cameraUntil", SystemClock.elapsedRealtime() + ms).apply()
    }

    fun cameraAllowed(c: Context): Boolean = prefs(c).getLong("cameraUntil", 0) > SystemClock.elapsedRealtime()

    // --- schedule --------------------------------------------------------------------------------

    fun schedule(c: Context): Schedule {
        val raw = prefs(c).getString("schedule", null) ?: return Schedule.None
        return runCatching { scheduleFromJson(JSONObject(raw)) }.getOrDefault(Schedule.None)
    }

    private fun scheduleToJson(s: Schedule): String =
        JSONObject()
            .put("timezone", s.timezone)
            .put(
                "rules",
                JSONArray(
                    s.rules.map {
                        JSONObject().put("mode", it.mode).put("days", it.days)
                            .put("startMinute", it.startMinute).put("endMinute", it.endMinute)
                    },
                ),
            ).toString()
}

fun scheduleFromJson(j: JSONObject): Schedule {
    val arr = j.getJSONArray("rules")
    return Schedule(
        j.getString("timezone"),
        List(arr.length()) {
            val r = arr.getJSONObject(it)
            Rule(r.getString("mode"), r.getInt("days"), r.getInt("startMinute"), r.getInt("endMinute"))
        },
    )
}
