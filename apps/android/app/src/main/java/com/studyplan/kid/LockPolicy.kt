package com.studyplan.kid

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodManager

/** Which apps are never blocked or charged, and whether the lock service is switched on. */
object LockPolicy {
    /**
     * Settings (where the lock can be switched off and the app uninstalled) and the system installers
     * (which show the uninstall confirmation). Parents-only until a parent approves them.
     */
    val protectedPackages = setOf(
        "com.android.settings",
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.samsung.android.packageinstaller",
    )

    /** Study Plan itself, the home screen, the dialer, system UI and keyboards. Everything else counts as screen time. */
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

    fun isServiceEnabled(c: Context): Boolean {
        val enabled = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
        val me = "${c.packageName}/${LockService::class.java.name}"
        return enabled.split(':').any { it.equals(me, ignoreCase = true) }
    }
}
