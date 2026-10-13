package com.studyplan.kid

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(
                        Modifier.fillMaxSize().padding(32.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        when (reason.value) {
                            LockReason.Protected -> ParentApproval()
                            LockReason.Scheduled -> {
                                Text("Phone is off", fontSize = 32.sp)
                                Text(
                                    if (untilMinute.value >= 0) "Locked until ${formatMinute(untilMinute.value)}." else "Locked for now.",
                                    fontSize = 18.sp,
                                )
                                KidButtons()
                            }
                            LockReason.NoCredit -> {
                                Text("Homework first", fontSize = 32.sp)
                                Text("Answer homework questions to earn screen time.", fontSize = 18.sp)
                                KidButtons()
                            }
                        }
                    }
                }
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun KidButtons() {
        Button(onClick = {
            startActivity(Intent(this@LockActivity, MainActivity::class.java))
            finish()
        }) { Text("Do homework") }
        OutlinedButton(onClick = ::checkAgain) { Text("Check again") }
    }

    /** Settings and uninstall screens: a parent types their PIN here, or approves from the dashboard. */
    @androidx.compose.runtime.Composable
    private fun ParentApproval() {
        var pin by remember { mutableStateOf("") }
        Text("Parents only", fontSize = 32.sp)
        Text(
            "Settings and uninstalling need a parent. Enter the parent PIN, or ask a parent to allow it in the parent dashboard.",
            fontSize = 16.sp,
        )
        OutlinedTextField(
            value = pin,
            onValueChange = { pin = it.filter(Char::isDigit).take(6) },
            label = { Text("Parent PIN") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth(),
        )
        error.value?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(onClick = { unlock(pin) }, enabled = !busy.value && pin.length >= 4, modifier = Modifier.fillMaxWidth()) {
            Text("Unlock for a few minutes")
        }
        OutlinedButton(onClick = ::checkAgain) { Text("A parent allowed it. Check again") }
        OutlinedButton(onClick = ::goHome) { Text("Back to home screen") }
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
