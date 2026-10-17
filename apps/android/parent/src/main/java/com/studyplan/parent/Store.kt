package com.studyplan.parent

import android.content.Context

/** The pairing token and the papers we already told the parent about, in app-private storage. */
object Store {
    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences("studyplan_parent", Context.MODE_PRIVATE)

    fun token(c: Context): String? = prefs(c).getString("token", null)

    fun setToken(c: Context, token: String?) {
        prefs(c).edit().apply {
            if (token == null) remove("token").remove("seen") else putString("token", token)
        }.apply()
    }

    /** Instant alerts (a check every half minute, with a small always-on notice). On by default once paired. */
    fun instantAlerts(c: Context): Boolean = prefs(c).getBoolean("instant", true)

    fun setInstantAlerts(c: Context, on: Boolean) {
        prefs(c).edit().putBoolean("instant", on).apply()
    }

    fun seenPapers(c: Context): Set<String> = prefs(c).getStringSet("seen", emptySet()) ?: emptySet()

    fun setSeenPapers(c: Context, ids: Set<String>) {
        prefs(c).edit().putStringSet("seen", ids.toSet()).apply()
    }
}
