package com.studyplan.kid

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
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
    val context = LocalContext.current
    var permissionsReady by remember { mutableStateOf(Permissions.ready(context)) }

    // Notifications only make the "Study Plan is on" notice visible; the lock works without them.
    val askNotifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    // Re-check the server and the permissions whenever the kid comes back to the app.
    LifecycleResumeEffect(Unit) {
        if (vm.screen == Screen.Home) vm.refresh()
        permissionsReady = Permissions.ready(context)
        Permissions.startService(context) // keeps the lock running; harmless when it already is
        onPauseOrDispose { }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (!permissionsReady) SetupCard()
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

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(s.name, fontSize = 28.sp)
    }

    TimeCard()

    val q = s.question
    if (q == null) {
        Text("No homework waiting. Ask a parent to add some.")
    } else {
        QuestionCard(vm, s, q)
    }

    if (s.paperSets.isNotEmpty()) PaperCard(vm, s.paperSets)
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

/** Live time left, and what the phone is doing right now (locked, free time, or counting down). */
@Composable
private fun TimeCard() {
    val context = LocalContext.current
    var remaining by remember { mutableLongStateOf(Store.remainingSec(context)) }
    var window by remember { mutableStateOf(activeWindow(Store.schedule(context), Store.nowMs(context))) }
    LaunchedEffect(Unit) {
        while (true) {
            remaining = Store.remainingSec(context)
            window = activeWindow(Store.schedule(context), Store.nowMs(context))
            delay(1_000)
        }
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Screen time left")
            Text("%d:%02d".format(remaining / 60, remaining % 60), fontSize = 44.sp, fontFamily = FontFamily.Monospace)
            Text(
                when (window?.mode) {
                    Mode.Blocked -> "The phone is locked until ${formatMinute(window!!.endMinute)}."
                    Mode.Free -> "Free time until ${formatMinute(window!!.endMinute)}. No minutes are used."
                    null -> "Just open any app. Your minutes are used automatically while the screen is on."
                },
                fontSize = 14.sp,
            )
        }
    }
}

/** The two permissions the lock needs. A parent grants them once, ideally before pairing. */
@Composable
private fun SetupCard() {
    val context = LocalContext.current
    val usage = Permissions.hasUsageAccess(context)
    val overlay = Permissions.canOverlay(context)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Parent setup", fontSize = 20.sp)
            Text("The screen lock needs two permissions. A parent grants them once in Settings. Settings is parents-only after pairing, so do this first.")
            if (!usage) {
                Text("1. Usage access lets the app see which app is open. It never sees what is on screen.", fontSize = 14.sp)
                OutlinedButton(onClick = { context.startActivity(Permissions.usageAccessIntent()) }) { Text("Allow usage access") }
            } else {
                Text("Usage access: on", fontSize = 14.sp)
            }
            if (!overlay) {
                Text("2. Display over other apps lets the lock screen cover a blocked app.", fontSize = 14.sp)
                OutlinedButton(onClick = { context.startActivity(Permissions.overlayIntent(context)) }) { Text("Allow display over other apps") }
            } else {
                Text("Display over other apps: on", fontSize = 14.sp)
            }
        }
    }
}
