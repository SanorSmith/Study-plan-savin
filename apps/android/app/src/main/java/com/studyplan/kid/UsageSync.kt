package com.studyplan.kid

import android.content.Context
import java.io.IOException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps the local time bank and the server in step. Everything runs under one lock so a refresh can't
 * land in the middle of a usage report and make the balance ambiguous.
 */
object UsageSync {
    private val mutex = Mutex()

    /** Sends any usage that is due (a report is retried with its original key) and optionally refreshes the balance and schedule. */
    suspend fun run(c: Context, refresh: Boolean) = mutex.withLock {
        val token = Store.token(c) ?: return@withLock
        try {
            val report = Store.inflight(c) ?: Store.startInflight(c)
            if (report != null) {
                val r = Api.usage(token, report.minutes, report.key)
                Store.finishInflight(c, r.balanceMinutes, r.serverNow)
            }
            if (refresh) {
                val s = Api.sync(token)
                Store.applySync(c, s.balanceMinutes, s.serverNow, s.schedule, s.approvedUntil)
            }
        } catch (e: ApiException) {
            if (e.status == 401) Store.setToken(c, null) // the parent removed this device
        } catch (_: IOException) {
            // Offline: the local bank keeps enforcing, and the report is retried next time.
        } catch (_: org.json.JSONException) {
        }
    }

    /** Applies a state fetched by the app UI. */
    suspend fun apply(c: Context, balanceMinutes: Int, serverNow: String, schedule: Schedule, approvedUntil: String?) = mutex.withLock {
        if (Store.inflight(c) == null) {
            Store.applySync(c, balanceMinutes, serverNow, schedule, approvedUntil)
        } else {
            Store.applyScheduleOnly(c, serverNow, schedule, approvedUntil)
        }
    }
}
