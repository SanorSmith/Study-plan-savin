package com.studyplan.parent

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

private const val CHANNEL = "papers"

/** Checks about every 15 minutes whether a kid sent a paper, and says so in a notification. */
class PaperCheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val token = Store.token(applicationContext) ?: return Result.success()
        val state = try {
            ParentApi.state(token)
        } catch (e: ApiException) {
            return if (e.status == 401) Result.success() else Result.retry()
        } catch (_: Exception) {
            return Result.retry()
        }
        val fresh = newPapers(Store.seenPapers(applicationContext), state.papers)
        // Remember what is waiting now; papers that were decided drop out of the list.
        Store.setSeenPapers(applicationContext, state.papers.map { it.id }.toSet())
        if (fresh.isNotEmpty()) Notifier.papers(applicationContext, fresh)
        return Result.success()
    }
}

object Notifier {
    private fun ensureChannel(c: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = c.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Papers to check", NotificationManager.IMPORTANCE_DEFAULT))
    }

    fun allowed(c: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun papers(c: Context, fresh: List<PaperItem>) {
        if (!allowed(c)) return
        ensureChannel(c)
        val (title, text) = notificationText(fresh)
        val open = PendingIntent.getActivity(
            c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        c.getSystemService(NotificationManager::class.java).notify(1, n)
    }

    fun schedule(c: Context) {
        val request = PeriodicWorkRequestBuilder<PaperCheckWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("paper-check", ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun cancel(c: Context) {
        WorkManager.getInstance(c).cancelUniqueWork("paper-check")
    }
}
