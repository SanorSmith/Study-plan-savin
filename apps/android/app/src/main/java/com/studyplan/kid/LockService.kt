package com.studyplan.kid

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Watches which app is in front (package name only, never its content) once a second while the screen is on.
 *
 * - An allowed app (Study Plan, home, dialer, keyboard, system UI): nothing happens.
 * - Any other app: if the parent's schedule locks the phone, or there is no credit left, the lock screen
 *   covers it. Otherwise the seconds are charged to the kid's bank automatically.
 * - Screen off: nothing is charged.
 */
class LockService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var lastPackage: String? = null
    private var lastTickAt = 0L
    private var carryMs = 0L
    private var lastLockAt = 0L
    private var lastReportAt = 0L
    private var lastRefreshAt = 0L
    private var allowed: Set<String> = emptySet()
    private var allowedAt = 0L

    private val tick = object : Runnable {
        override fun run() {
            tick()
            handler.postDelayed(this, 1_000)
        }
    }

    override fun onServiceConnected() {
        lastTickAt = SystemClock.elapsedRealtime()
        scope.launch { UsageSync.run(this@LockService, refresh = true) }
        lastRefreshAt = lastTickAt
        handler.post(tick)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        lastPackage = event.packageName?.toString() ?: return
        // React at once to a newly opened app instead of waiting for the next tick.
        if (isInteractive()) evaluate(lastPackage, 0)
    }

    private fun isInteractive() = getSystemService(PowerManager::class.java).isInteractive

    private fun tick() {
        val now = SystemClock.elapsedRealtime()
        val dt = (now - lastTickAt).coerceIn(0, 5_000)
        lastTickAt = now

        // Screen off: nothing is charged and nothing is enforced.
        if (isInteractive()) evaluate(rootInActiveWindow?.packageName?.toString() ?: lastPackage, dt)

        // Send usage once a minute is due, and refresh the balance and schedule every few minutes.
        val refresh = now - lastRefreshAt > REFRESH_MS
        val reportDue = (Store.pendingSec(this) >= 60 || Store.inflight(this) != null) && now - lastReportAt > REPORT_MS
        if (refresh || reportDue) {
            lastReportAt = now
            if (refresh) lastRefreshAt = now
            scope.launch { UsageSync.run(this@LockService, refresh) }
        }
    }

    private fun evaluate(pkg: String?, dtMs: Long) {
        val now = SystemClock.elapsedRealtime()
        if (now - allowedAt > ALLOWED_TTL_MS || allowed.isEmpty()) {
            allowed = LockPolicy.allowedPackages(this)
            allowedAt = now
        }
        val decision = decide(
            paired = Store.token(this) != null,
            allowedApp = pkg == null || pkg in allowed,
            window = activeWindow(Store.schedule(this), Store.nowMs(this)),
            remainingSec = Store.remainingSec(this),
        )
        when (decision) {
            Decision.Allow -> Unit
            Decision.Consume -> {
                carryMs += dtMs
                val whole = carryMs / 1_000
                if (whole > 0) {
                    Store.addUsage(this, whole)
                    carryMs -= whole * 1_000
                }
            }
            is Decision.Lock -> showLock(decision, now)
        }
    }

    private fun showLock(lock: Decision.Lock, now: Long) {
        if (now - lastLockAt < 1_000) return // avoid fighting the launcher
        lastLockAt = now
        // The lock screen covers the blocked app. Also sending the phone home let the launcher win and hide it.
        startActivity(
            Intent(this, LockActivity::class.java)
                .putExtra(LockActivity.EXTRA_REASON, lock.reason.name)
                .putExtra(LockActivity.EXTRA_UNTIL, lock.untilMinute ?: -1)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION),
        )
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        scope.cancel()
        super.onDestroy()
    }

    private companion object {
        const val REPORT_MS = 30_000L
        const val REFRESH_MS = 5 * 60_000L
        const val ALLOWED_TTL_MS = 60_000L
    }
}
