package com.studyplan.kid

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** Shown over blocked apps when the phone is locked by the schedule or has no screen time left. */
class LockActivity : ComponentActivity() {
    private val reason = mutableStateOf(LockReason.NoCredit)
    private val untilMinute = mutableStateOf(-1)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        readIntent(intent)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(
                        Modifier.fillMaxSize().padding(32.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        if (reason.value == LockReason.Scheduled) {
                            Text("Phone is off", fontSize = 32.sp)
                            Text(
                                if (untilMinute.value >= 0) "Locked until ${formatMinute(untilMinute.value)}." else "Locked for now.",
                                fontSize = 18.sp,
                            )
                        } else {
                            Text("Homework first", fontSize = 32.sp)
                            Text("Answer homework questions to earn screen time.", fontSize = 18.sp)
                        }
                        Button(onClick = {
                            startActivity(Intent(this@LockActivity, MainActivity::class.java))
                            finish()
                        }) { Text("Do homework") }
                        OutlinedButton(onClick = ::checkAgain) { Text("Check again") }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readIntent(intent)
    }

    private fun readIntent(intent: Intent) {
        reason.value = runCatching { LockReason.valueOf(intent.getStringExtra(EXTRA_REASON) ?: "") }.getOrDefault(LockReason.NoCredit)
        untilMinute.value = intent.getIntExtra(EXTRA_UNTIL, -1)
    }

    /** Fetches the latest balance and schedule (a parent may have added a bonus) and leaves if the phone may be used now. */
    private fun checkAgain() {
        lifecycleScope.launch {
            UsageSync.run(this@LockActivity, refresh = true)
            val window = activeWindow(Store.schedule(this@LockActivity), Store.nowMs(this@LockActivity))
            val decision = decide(true, false, window, Store.remainingSec(this@LockActivity))
            if (decision !is Decision.Lock) finish()
        }
    }

    @Deprecated("Back goes home, never to the blocked app")
    override fun onBackPressed() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    companion object {
        const val EXTRA_REASON = "reason"
        const val EXTRA_UNTIL = "until"
    }
}
