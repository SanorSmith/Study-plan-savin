package com.studyplan.kid

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * The two special permissions the lock needs. A parent grants both once, in Settings:
 * - Usage access: lets the app see which app is in front (package names only).
 * - Display over other apps: lets the app show the lock screen on top of a blocked app.
 */
object Permissions {
    @Suppress("DEPRECATION")
    fun hasUsageAccess(c: Context): Boolean {
        val ops = c.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        } else {
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun canOverlay(c: Context): Boolean = Settings.canDrawOverlays(c)

    fun ready(c: Context): Boolean = hasUsageAccess(c) && canOverlay(c)

    fun usageAccessIntent(): Intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)

    fun overlayIntent(c: Context): Intent =
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${c.packageName}"))

    /** Starts the lock service once the permissions are in place. Safe to call again. */
    fun startService(c: Context) {
        if (ready(c)) ContextCompat.startForegroundService(c, Intent(c, LockService::class.java))
    }
}
