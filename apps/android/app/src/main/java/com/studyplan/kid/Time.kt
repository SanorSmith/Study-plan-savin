package com.studyplan.kid

import java.time.Instant

/** Milliseconds left in a session, measured on the server's clock so changing the phone's time does not help. */
fun remainingMs(endsAt: String, serverNow: String): Long =
    (Instant.parse(endsAt).toEpochMilli() - Instant.parse(serverNow).toEpochMilli()).coerceAtLeast(0)
