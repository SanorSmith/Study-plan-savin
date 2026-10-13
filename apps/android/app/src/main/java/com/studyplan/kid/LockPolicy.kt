package com.studyplan.kid

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodManager

/** Which apps may be used while no screen time is running. */
object LockPolicy {
    /** Study Plan itself, the home screen, the dialer, system UI and keyboards. Everything else is locked. */
    fun allowedPackages(c: Context): Set<String> {
        val pm = c.packageManager
        val allowed = mutableSetOf(c.packageName, "android", "com.android.systemui")
        pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .forEach { allowed += it.activityInfo.packageName }
        pm.queryIntentActivities(Intent(Intent.ACTION_DIAL), 0)
            .forEach { allowed += it.activityInfo.packageName }
        (c.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
            .enabledInputMethodList.forEach { allowed += it.packageName }
        return allowed
    }

    fun shouldLock(c: Context, foregroundPackage: String?): Boolean {
        if (foregroundPackage == null) return false
        if (Store.token(c) == null) return false // not paired: never lock
        if (Store.sessionRemainingMs(c) > 0) return false
        return foregroundPackage !in allowedPackages(c)
    }

    fun isServiceEnabled(c: Context): Boolean {
        val enabled = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
        val me = "${c.packageName}/${LockService::class.java.name}"
        return enabled.split(':').any { it.equals(me, ignoreCase = true) }
    }
}
