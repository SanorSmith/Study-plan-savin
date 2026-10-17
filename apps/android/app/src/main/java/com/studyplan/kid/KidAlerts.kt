package com.studyplan.kid

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import java.io.IOException

/** One thing a parent sent: new homework, new practice, or a message. */
data class News(val id: String, val title: String, val text: String)

/**
 * Rings when a parent sends homework, practice or a message. The service asks the server every minute; ids already
 * rung for are remembered, and the first look after pairing only learns what is already there, so nothing old rings.
 */
object KidAlerts {
    private const val CHANNEL = "from_parent"

    /** Returns quietly when offline or not paired. */
    suspend fun check(c: Context) {
        val token = Store.token(c) ?: return
        val items = try {
            Api.news(token)
        } catch (_: ApiException) {
            return
        } catch (_: IOException) {
            return
        } catch (_: org.json.JSONException) {
            return
        }
        val known = Store.newsSeen(c)
        Store.setNewsSeen(c, items.map { it.id }.toSet())
        if (known == null) return
        val fresh = items.filter { it.id !in known }
        if (fresh.isNotEmpty()) ring(c, fresh)
    }

    private fun ring(c: Context, fresh: List<News>) {
        val manager = c.getSystemService(NotificationManager::class.java)
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "From your parent", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "New homework, practice and messages"
                setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
                enableVibration(true)
            },
        )
        val open = PendingIntent.getActivity(
            c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val first = fresh.first()
        val title = if (fresh.size == 1) first.title else "${fresh.size} new things from your parent"
        val text = if (fresh.size == 1) first.text else fresh.joinToString(", ") { it.title }
        val notification = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        // Without the notifications permission this is silently dropped.
        runCatching { manager.notify(2, notification) }
    }
}
