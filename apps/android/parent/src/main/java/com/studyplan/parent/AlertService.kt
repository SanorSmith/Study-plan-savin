package com.studyplan.parent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How long to wait before asking again: half a minute normally, longer after failures (no signal) so the battery is spared. */
fun pollDelayMs(failures: Int): Long = (30_000L * (1L shl failures.coerceIn(0, 4))).coerceAtMost(300_000L)

/**
 * Instant alerts: a foreground service that asks the server every half minute whether a kid sent a paper and rings
 * right away. It shows one quiet notice so Android keeps it running. Without it the app checks about every 15 minutes.
 */
class AlertService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundNotice()
        if (job?.isActive != true) job = scope.launch { watch() }
        return START_STICKY
    }

    private suspend fun watch() {
        var failures = 0
        while (true) {
            val token = Store.token(this)
            if (token == null) {
                stopSelf()
                return
            }
            try {
                val papers = ParentApi.pending(token)
                val fresh = newPapers(Store.seenPapers(this), papers)
                Store.setSeenPapers(this, papers.map { it.id }.toSet())
                if (fresh.isNotEmpty()) Notifier.papers(this, fresh)
                failures = 0
            } catch (e: ApiException) {
                if (e.status == 401) { stopSelf(); return }
                failures += 1
            } catch (_: Exception) {
                failures += 1
            }
            delay(pollDelayMs(failures))
        }
    }

    private fun startForegroundNotice() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel("watching", "Instant alerts", NotificationManager.IMPORTANCE_MIN))
        }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notice: Notification = NotificationCompat.Builder(this, "watching")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Study Plan is watching for papers")
            .setContentText("You get a sound when a kid sends homework")
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(2, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(2, notice)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        fun start(c: Context) {
            if (Store.token(c) == null || !Store.instantAlerts(c)) return
            runCatching { c.startForegroundService(Intent(c, AlertService::class.java)) }
        }

        fun stop(c: Context) {
            c.stopService(Intent(c, AlertService::class.java))
        }
    }
}
