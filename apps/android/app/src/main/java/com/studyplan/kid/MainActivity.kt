package com.studyplan.kid

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val vm: StudyViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StudyTheme(vm.band) {
                PageBackground { StudyApp(vm) }
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

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (!permissionsReady) SetupCard()
            when (vm.screen) {
                Screen.Loading -> Text("…", style = MaterialTheme.typography.headlineMedium)
                Screen.Pair -> PairScreen(vm)
                Screen.Pin -> PinScreen(vm)
                Screen.Home -> vm.state?.let { HomeScreen(vm, it) } ?: Text("…")
            }
            vm.message?.let {
                Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
        }
        vm.celebration?.let { CelebrationOverlay(it.emoji, it.text) }
    }
}

@Composable
private fun PairScreen(vm: StudyViewModel) {
    val copy = Copies.of(vm.band)
    var code by remember { mutableStateOf("") }
    LookCard {
        Text(copy.pairTitle, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
        Text(copy.pairHint, style = MaterialTheme.typography.bodyLarge)
        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase().take(16) },
            label = { Text("Pairing code") },
            singleLine = true,
            textStyle = MaterialTheme.typography.headlineSmall.copy(textAlign = TextAlign.Center, fontWeight = FontWeight.Bold),
            modifier = Modifier.fillMaxWidth(),
        )
        Button(onClick = { vm.pair(code) }, enabled = !vm.busy && code.isNotBlank(), modifier = Modifier.fillMaxWidth().height(56.dp)) {
            Text("Go", style = MaterialTheme.typography.titleLarge)
        }
    }
}

/** The PIN is typed on an on-screen pad for every age: it is quicker and never opens the keyboard. */
@Composable
private fun PinScreen(vm: StudyViewModel) {
    val copy = Copies.of(vm.band)
    var pin by remember { mutableStateOf("") }
    LaunchedEffect(vm.message) { if (vm.message != null) pin = "" } // a wrong PIN starts again
    LookCard {
        Text(
            copy.pinTitle,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        PinDots(length = 4, filled = pin.length)
        Keypad(
            enabled = !vm.busy,
            allowDecimal = false,
            onKey = { key ->
                pin = applyKey(pin, key, 4, false)
                if (pin.length == 4) vm.unlock(pin)
            },
        )
    }
}

@Composable
private fun HomeScreen(vm: StudyViewModel, s: KidState) {
    val copy = Copies.of(vm.band)
    Text(copy.hi(s.name), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)

    TimeCard(copy)

    if (vm.celebration == null) vm.feedback?.let { FeedbackBox(it) }

    val q = s.question
    if (q == null) {
        LookCard {
            Text(
                if (vm.feedback != null) copy.allDone else copy.noHomework,
                style = MaterialTheme.typography.titleLarge,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    } else {
        QuestionCard(vm, s, q, copy)
    }

    if (s.paperSets.isNotEmpty()) PaperCard(vm, s.paperSets, s.aiCheckEnabled)
}

@Composable
private fun FeedbackBox(feedback: Feedback) {
    val (container, content) = when (feedback.tone) {
        Tone.Good -> Color(0xFFD1FAE5) to Color(0xFF065F46)
        Tone.Bad -> Color(0xFFFFE4E6) to Color(0xFF9F1239)
        Tone.Info -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurface
    }
    Box(Modifier.fillMaxWidth().background(container, RoundedCornerShape(LocalLook.current.corner * 0.75f)).padding(16.dp)) {
        Text(feedback.text, color = content, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

/** The time left as a ring on a bright card, with what the phone is doing right now. The explanation hides behind a ? button. */
@Composable
private fun TimeCard(copy: Copy) {
    val context = LocalContext.current
    var remaining by remember { mutableLongStateOf(Store.remainingSec(context)) }
    var window by remember { mutableStateOf(activeWindow(Store.schedule(context), Store.nowMs(context))) }
    var showInfo by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        while (true) {
            remaining = Store.remainingSec(context)
            window = activeWindow(Store.schedule(context), Store.nowMs(context))
            delay(1_000)
        }
    }
    val look = LocalLook.current
    HeroCard {
        TimeGauge(minutes = ((remaining + 59) / 60).toInt(), unit = copy.minutes, showEmoji = look.band == AgeBand.Little)
        when (window?.mode) {
            Mode.Blocked -> StatusPill(copy.locked(formatMinute(window!!.endMinute)), Color.Black.copy(alpha = 0.25f), Color.White)
            Mode.Free -> StatusPill(copy.free(formatMinute(window!!.endMinute)), Color.White.copy(alpha = 0.25f), Color.White)
            null -> Unit
        }
        Box(
            Modifier.size(36.dp).background(Color.White.copy(alpha = 0.25f), CircleShape).clickable { showInfo = !showInfo }
                .semantics { contentDescription = "What is this?" },
            contentAlignment = Alignment.Center,
        ) { Text(if (showInfo) "×" else "?", color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium) }
        if (showInfo) Text(copy.info, color = Color.White, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    }
}

@Composable
private fun StatusPill(text: String, container: Color, content: Color) {
    Box(Modifier.fillMaxWidth().background(container, CircleShape).padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(text, color = content, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun QuestionCard(vm: StudyViewModel, s: KidState, q: Question, copy: Copy) {
    val look = LocalLook.current
    var answer by remember(q.id) { mutableStateOf("") }
    LookCard {
        s.progress?.let { HomeworkProgress(it.done, it.total) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoPill(q.subject)
            InfoPill("+${minOf(s.minutesPerQuestion, s.earnableTodayMinutes)} ${copy.minutes}")
        }
        Text(q.text, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)

        when {
            q.type == "multiple_choice" && q.options != null -> AnswerOptions(q.options, enabled = !vm.busy) { vm.answer(q, it) }

            look.bigKeypad && q.type == "numeric" -> {
                Box(
                    Modifier.fillMaxWidth().height(72.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(look.corner * 0.7f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        answer.ifEmpty { "?" },
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Black,
                        color = if (answer.isEmpty()) MaterialTheme.colorScheme.primary.copy(alpha = 0.3f) else MaterialTheme.colorScheme.onSurface,
                    )
                }
                Keypad(enabled = !vm.busy, allowDecimal = true, onKey = { answer = applyKey(answer, it, 8, true) })
                Button(onClick = { vm.answer(q, answer) }, enabled = !vm.busy && answer.isNotBlank(), modifier = Modifier.fillMaxWidth().height(64.dp)) {
                    Text(copy.answer, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                }
            }

            else -> {
                OutlinedTextField(
                    value = answer,
                    onValueChange = { answer = it.take(50) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = if (q.type == "numeric") KeyboardType.Decimal else KeyboardType.Text),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(onClick = { vm.answer(q, answer.trim()) }, enabled = !vm.busy && answer.isNotBlank(), modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text(copy.answer, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

/** The two permissions the lock needs. A parent grants them once, ideally before pairing. */
@Composable
private fun SetupCard() {
    val context = LocalContext.current
    val usage = Permissions.hasUsageAccess(context)
    val overlay = Permissions.canOverlay(context)
    LookCard {
        Text("Parent setup", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(
            "The screen lock needs two permissions. A parent grants them once in Settings. Settings is parents-only after pairing, so do this first.",
            style = MaterialTheme.typography.bodyMedium,
        )
        if (!usage) {
            Text("1. Usage access lets the app see which app is open. It never sees what is on screen.", style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = { context.startActivity(Permissions.usageAccessIntent()) }) { Text("Allow usage access") }
        } else {
            Text("✓ Usage access is on", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        }
        if (!overlay) {
            Text("2. Display over other apps lets the lock screen cover a blocked app.", style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = { context.startActivity(Permissions.overlayIntent(context)) }) { Text("Allow display over other apps") }
        } else {
            Text("✓ Display over other apps is on", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        }
    }
}
