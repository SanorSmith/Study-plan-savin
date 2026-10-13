package com.studyplan.kid

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

/**
 * Watches which app is in front (package name only, never content). When there is no
 * screen time left, it sends the child home and shows the lock screen.
 */
class LockService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private var lastPackage: String? = null
    private var lastLockAt = 0L

    private val tick = object : Runnable {
        override fun run() {
            enforce(rootInActiveWindow?.packageName?.toString() ?: lastPackage)
            handler.postDelayed(this, 2_000)
        }
    }

    override fun onServiceConnected() {
        handler.post(tick)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        lastPackage = pkg
        enforce(pkg)
    }

    private fun enforce(pkg: String?) {
        if (!LockPolicy.shouldLock(this, pkg)) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastLockAt < 1_000) return // avoid fighting the launcher
        lastLockAt = now
        performGlobalAction(GLOBAL_ACTION_HOME)
        startActivity(Intent(this, LockActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        super.onDestroy()
    }
}
