package com.studyplan.kid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Starts the lock again after a restart or an app update. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Store.token(context) != null) Permissions.startService(context)
    }
}
