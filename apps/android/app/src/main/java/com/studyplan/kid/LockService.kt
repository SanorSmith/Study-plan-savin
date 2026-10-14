package com.studyplan.kid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Runs while the phone is paired. Twice a second, while the screen is on, it asks Android which app is in
 * front (package name only, never its content) and decides:
 *
 * - An allowed app (Study Plan, home, dialer, keyboard, system UI): nothing happens.
 * - Settings and the uninstall screens: parents-only until a parent approves them, whatever the credit.
 * - Any other app: if the parent's schedule locks the phone, or there is no credit left, a full-screen cover
 *   appears over it. Otherwise the seconds are charged to the kid's bank automatically.
 * - Screen off: nothing is charged and nothing is shown.
 */
class LockService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val tracker = ForegroundTracker()
    private lateinit var overlay: LockOverlay

    private var started = false
    private var lastEventTime = 0L
    private var lastTickAt = 0L
    private var carryMs = 0L
    private var lastReportAt = 0L
    private var lastRefreshAt = 0L
    private var allowed: Set<String> = emptySet()
    private var allowedAt = 0L

    private val tick = object : Runnable {
        override fun run() {
            runCatching { tick() }
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        overlay = LockOverlay(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startInForeground()
        if (!started) {
            started = true
            val now = SystemClock.elapsedRealtime()
            lastTickAt = now
            lastRefreshAt = now
            // First poll replays the last day of events, so the app in front right now is known at once.
            lastEventTime = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
            scope.launch { UsageSync.run(this@LockService, refresh = true) }
            handler.post(tick)
        }
        return START_STICKY
    }

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Screen time", NotificationManager.IMPORTANCE_LOW),
        )
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("Study Plan is on")
            .setContentText("Your parent manages screen time on this phone.")
            .setOngoing(true)
            .build()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    private fun tick() {
        val now = SystemClock.elapsedRealtime()
        val dt = (now - lastTickAt).coerceIn(0, 5_000)
        lastTickAt = now

        val paired = Store.token(this) != null
        if (paired && Permissions.ready(this) && getSystemService(PowerManager::class.java).isInteractive) {
            pollForeground()
            evaluate(tracker.current, dt)
        } else {
            overlay.hide() // not paired, permissions missing, or screen off: nothing is charged or enforced
        }
        if (paired) maybeSync(now)
    }

    /** Feeds new usage events to the tracker. */
    private fun pollForeground() {
        val events = getSystemService(UsageStatsManager::class.java)
            .queryEvents(lastEventTime + 1, System.currentTimeMillis()) ?: return
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            tracker.apply(event.eventType, pkg)
            if (event.timeStamp > lastEventTime) lastEventTime = event.timeStamp
        }
    }

    private fun evaluate(pkg: String?, dtMs: Long) {
        val now = SystemClock.elapsedRealtime()
        if (now - allowedAt > ALLOWED_TTL_MS || allowed.isEmpty()) {
            allowed = LockPolicy.allowedPackages(this)
            allowedAt = now
        }
        val decision = decide(
            paired = true,
            allowedApp = pkg == null || pkg in allowed,
            protectedApp = pkg != null && pkg in LockPolicy.protectedPackages,
            approved = Store.isApproved(this),
            window = activeWindow(Store.schedule(this), Store.nowMs(this)),
            remainingSec = Store.remainingSec(this),
        )
        when (decision) {
            is Decision.Lock -> overlay.show(decision.reason, decision.untilMinute)
            Decision.Consume -> {
                overlay.hide()
                carryMs += dtMs
                val whole = carryMs / 1_000
                if (whole > 0) {
                    Store.addUsage(this, whole)
                    carryMs -= whole * 1_000
                }
            }
            Decision.Allow -> overlay.hide()
        }
    }

    /** Sends usage once a minute is due, and refreshes the balance and schedule every few minutes. */
    private fun maybeSync(now: Long) {
        val refresh = now - lastRefreshAt > REFRESH_MS
        val reportDue = (Store.pendingSec(this) >= 60 || Store.inflight(this) != null) && now - lastReportAt > REPORT_MS
        if (refresh || reportDue) {
            lastReportAt = now
            if (refresh) lastRefreshAt = now
            scope.launch { UsageSync.run(this@LockService, refresh) }
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        overlay.hide()
        scope.cancel()
        super.onDestroy()
    }

    private companion object {
        const val CHANNEL_ID = "screen_time"
        const val NOTIFICATION_ID = 1
        const val TICK_MS = 500L
        const val REPORT_MS = 30_000L
        const val REFRESH_MS = 5 * 60_000L
        const val ALLOWED_TTL_MS = 60_000L
    }
}
