package com.studyplan.kid

import android.content.Context
import android.os.SystemClock
import android.provider.Settings

/** Device token and screen-time session, kept in app-private storage so the lock service can read it offline. */
object Store {
    private fun prefs(c: Context) =
        c.applicationContext.getSharedPreferences("studyplan", Context.MODE_PRIVATE)

    private fun bootCount(c: Context) = Settings.Global.getInt(c.contentResolver, Settings.Global.BOOT_COUNT, 0)

    fun token(c: Context): String? = prefs(c).getString("token", null)

    fun setToken(c: Context, token: String?) {
        prefs(c).edit().apply {
            if (token == null) {
                remove("token")
                remove("sessionEnd")
            } else {
                putString("token", token)
            }
        }.apply()
    }

    /** Records how long the current session has left. Uses the monotonic clock, not wall time. */
    fun setSession(c: Context, remainingMs: Long) {
        prefs(c).edit()
            .putLong("sessionEnd", if (remainingMs > 0) SystemClock.elapsedRealtime() + remainingMs else 0)
            .putInt("sessionBoot", bootCount(c))
            .apply()
    }

    fun sessionRemainingMs(c: Context): Long {
        val p = prefs(c)
        if (p.getInt("sessionBoot", -1) != bootCount(c)) return 0 // a reboot ends the session
        return (p.getLong("sessionEnd", 0) - SystemClock.elapsedRealtime()).coerceAtLeast(0)
    }
}
