package com.studyplan.kid

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import java.io.IOException
import kotlinx.coroutines.launch

/** Shown over blocked apps: no screen time left, a locked schedule window, or parents-only Settings. */
class LockActivity : ComponentActivity() {
    private val reason = mutableStateOf(LockReason.NoCredit)
    private val untilMinute = mutableStateOf(-1)
    private val error = mutableStateOf<String?>(null)
    private val busy = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        readIntent(intent)
        val band = Store.band(this)
        setContent {
            StudyTheme(band) {
                PageBackground {
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(28.dp),
                        verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        val text = lockText(band, reason.value, untilMinute.value.takeIf { it >= 0 })
                        Text(
                            text.title,
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center,
                        )
                        Text(text.body, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                        if (reason.value == LockReason.Protected) ParentApproval() else KidButtons()
                    }
                }
            }
        }
    }

    @Composable
    private fun KidButtons() {
        Button(
            onClick = {
                startActivity(Intent(this@LockActivity, MainActivity::class.java))
                finish()
            },
            modifier = Modifier.fillMaxWidth().height(60.dp),
        ) { Text("Do homework", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        OutlinedButton(onClick = ::checkAgain, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Check again") }
    }

    /** Settings and uninstall screens: a parent types their PIN on the pad, or approves from the dashboard. */
    @Composable
    private fun ParentApproval() {
        var pin by remember { mutableStateOf("") }
        Text("Enter the parent PIN, or ask a parent to allow it in the parent dashboard.", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        PinDots(length = 6, filled = pin.length)
        error.value?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center) }
        Keypad(
            allowDecimal = false,
            enabled = !busy.value,
            onKey = { key ->
                pin = applyKey(pin, key, 6, false)
                if (pin.length == 6) {
                    unlock(pin)
                    pin = ""
                }
            },
        )
        OutlinedButton(onClick = ::checkAgain, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("A parent allowed it. Check again") }
        OutlinedButton(onClick = ::goHome, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Back to home screen") }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readIntent(intent)
    }

    private fun readIntent(intent: Intent) {
        reason.value = runCatching { LockReason.valueOf(intent.getStringExtra(EXTRA_REASON) ?: "") }.getOrDefault(LockReason.NoCredit)
        untilMinute.value = intent.getIntExtra(EXTRA_UNTIL, -1)
        error.value = null
    }

    private fun unlock(pin: String) {
        val token = Store.token(this) ?: return
        lifecycleScope.launch {
            busy.value = true
            error.value = null
            try {
                val r = Api.parentUnlock(token, pin)
                Store.setApproved(this@LockActivity, r.approvedUntil, r.serverNow)
                finish()
            } catch (e: ApiException) {
                error.value = e.message
            } catch (_: IOException) {
                error.value = "No connection. Check the internet, or approve it in the parent dashboard."
            } catch (_: org.json.JSONException) {
                error.value = "The server sent something unexpected."
            } finally {
                busy.value = false
            }
        }
    }

    /** Fetches the latest balance, schedule and approval (a parent may have added a bonus or approved Settings) and leaves if allowed now. */
    private fun checkAgain() {
        lifecycleScope.launch {
            UsageSync.run(this@LockActivity, refresh = true)
            val c = this@LockActivity
            val window = activeWindow(Store.schedule(c), Store.nowMs(c))
            val decision = decide(
                paired = true,
                allowedApp = false,
                protectedApp = reason.value == LockReason.Protected,
                approved = Store.isApproved(c),
                window = window,
                remainingSec = Store.remainingSec(c),
            )
            if (decision !is Decision.Lock) finish()
        }
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    @Deprecated("Back goes home, never to the blocked app")
    override fun onBackPressed() = goHome()

    companion object {
        const val EXTRA_REASON = "reason"
        const val EXTRA_UNTIL = "until"
    }
}
