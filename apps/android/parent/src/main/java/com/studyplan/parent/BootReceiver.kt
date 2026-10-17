package com.studyplan.parent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** After a restart or an update, instant alerts start again if they were on. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        AlertService.start(context)
    }
}
