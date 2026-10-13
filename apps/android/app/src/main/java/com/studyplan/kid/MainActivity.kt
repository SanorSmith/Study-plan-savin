package com.studyplan.kid

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val vm: StudyViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) { StudyApp(vm) }
            }
        }
    }
}

@Composable
fun StudyApp(vm: StudyViewModel) {
    // Re-check the server whenever the kid comes back to the app.
    LifecycleResumeEffect(Unit) {
        if (vm.screen == Screen.Home) vm.refresh()
        onPauseOrDispose { }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        when (vm.screen) {
            Screen.Loading -> Text("Loading…")
            Screen.Pair -> CodeEntry(
                title = "Connect this phone",
                label = "Pairing code from your parent",
                secret = false,
                busy = vm.busy,
                onSubmit = vm::pair,
            )
            Screen.Pin -> CodeEntry(
                title = "Hi!",
                label = "Your PIN",
                secret = true,
                busy = vm.busy,
                onSubmit = vm::unlock,
            )
            Screen.Home -> vm.state?.let { Home(vm, it) } ?: Text("Loading…")
        }
        vm.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, fontSize = 16.sp) }
    }
}

@Composable
private fun CodeEntry(title: String, label: String, secret: Boolean, busy: Boolean, onSubmit: (String) -> Unit) {
    var value by remember { mutableStateOf("") }
    Text(title, fontSize = 28.sp)
    OutlinedTextField(
        value = value,
        onValueChange = { value = if (secret) it.filter(Char::isDigit).take(4) else it.take(16) },
        label = { Text(label) },
        singleLine = true,
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (secret) KeyboardType.NumberPassword else KeyboardType.Ascii),
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = { onSubmit(value) }, enabled = !busy && value.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
        Text("Go")
    }
}

@Composable
private fun Home(vm: StudyViewModel, s: KidState) {
    val context = LocalContext.current
    var lockEnabled by remember { mutableStateOf(LockPolicy.isServiceEnabled(context)) }
    LifecycleResumeEffect(Unit) {
        lockEnabled = LockPolicy.isServiceEnabled(context)
        onPauseOrDispose { }
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(s.name, fontSize = 28.sp)
        Text("${s.balanceMinutes} min banked", fontSize = 18.sp)
    }

    if (!lockEnabled) {
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("The screen lock is off. Ask a parent to turn on \"Study Plan screen lock\" in Accessibility settings.")
                OutlinedButton(onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) {
                    Text("Open Accessibility settings")
                }
            }
        }
    }

    Countdown(vm)

    val running = Store.sessionRemainingMs(context) > 0
    if (!running && s.balanceMinutes > 0) {
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Use your minutes", fontSize = 18.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(5, 10, 15, 30, s.balanceMinutes).filter { it in 1..s.balanceMinutes }.distinct().forEach { m ->
                        OutlinedButton(onClick = { vm.spend(m) }, enabled = !vm.busy) { Text("$m min") }
                    }
                }
            }
        }
    }

    val q = s.question
    if (q == null) {
        Text("No homework waiting. Ask a parent to add some.")
    } else {
        QuestionCard(vm, s, q)
    }
}

@Composable
private fun QuestionCard(vm: StudyViewModel, s: KidState, q: Question) {
    var answer by remember(q.id) { mutableStateOf("") }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("${q.subject} · worth up to ${minOf(s.minutesPerQuestion, s.earnableTodayMinutes)} min", fontSize = 14.sp)
            Text(q.text, fontSize = 20.sp)
            if (q.type == "multiple_choice" && q.options != null) {
                q.options.forEach { option ->
                    OutlinedButton(onClick = { vm.answer(q, option) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) {
                        Text(option)
                    }
                }
            } else {
                OutlinedTextField(
                    value = answer,
                    onValueChange = { answer = it.take(50) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(onClick = { vm.answer(q, answer.trim()) }, enabled = !vm.busy && answer.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                    Text("Answer")
                }
            }
        }
    }
}

/** Ticks once a second while a screen-time session is running. */
@Composable
private fun Countdown(vm: StudyViewModel) {
    val context = LocalContext.current
    var left by remember { mutableLongStateOf(Store.sessionRemainingMs(context)) }
    LaunchedEffect(Unit) {
        while (true) {
            val before = left
            left = Store.sessionRemainingMs(context)
            if (before > 0 && left == 0L) vm.refresh()
            delay(1_000)
        }
    }
    if (left > 0) {
        val total = left / 1000
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp).fillMaxWidth()) {
                Text("Screen time left")
                Text("%02d:%02d".format(total / 60, total % 60), fontSize = 44.sp, fontFamily = FontFamily.Monospace)
            }
        }
    }
}
