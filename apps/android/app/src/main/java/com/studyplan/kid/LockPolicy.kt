package com.studyplan.kid

import android.content.Context
import android.content.Intent
import android.provider.MediaStore
import android.view.inputmethod.InputMethodManager

/** Which apps are never blocked or charged, and which are parents-only. */
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

    /** The camera app and the photo pickers, allowed only while a paper is being photographed. */
    fun cameraPackages(c: Context): Set<String> {
        val pm = c.packageManager
        val found = mutableSetOf(
            "com.google.android.providers.media.module",
            "com.android.providers.media.module",
            "com.google.android.documentsui",
            "com.android.documentsui",
        )
        pm.queryIntentActivities(Intent(MediaStore.ACTION_IMAGE_CAPTURE), 0).forEach { found += it.activityInfo.packageName }
        pm.queryIntentActivities(Intent(Intent.ACTION_GET_CONTENT).setType("image/*"), 0).forEach { found += it.activityInfo.packageName }
        return found
    }

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
}
