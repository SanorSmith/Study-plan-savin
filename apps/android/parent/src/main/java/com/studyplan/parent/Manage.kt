package com.studyplan.parent

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Spacer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File

private val cardGap = Arrangement.spacedBy(10.dp)

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    SoftCard {
        Column(Modifier.padding(16.dp), verticalArrangement = cardGap) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

private val KID_TABS = listOf(Triple("today", "🏠", "Today"), Triple("homework", "📚", "Homework"), Triple("time", "⏰", "Time"), Triple("settings", "⚙️", "Settings"))

@Composable
fun KidScreen(vm: ParentViewModel, kidId: String, initialTab: String = "today") {
    val summary = vm.state?.kids?.firstOrNull { it.id == kidId }
    val detail = vm.kid?.takeIf { it.id == kidId }
    var withdraw by rememberSaveable { mutableStateOf("") }
    var confirmEmpty by remember { mutableStateOf(false) }
    var addingRule by remember { mutableStateOf(false) }
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    var message by rememberSaveable { mutableStateOf("") }
    var moreAmounts by rememberSaveable { mutableStateOf(false) }

    Page {
        TextButton(onClick = { vm.goHome() }) { Text("← All kids") }
        if (summary == null && detail == null) {
            Text(if (vm.busy) "Loading…" else "This kid was not found.", style = MaterialTheme.typography.bodyLarge)
            return@Page
        }
        val name = detail?.name ?: summary!!.name
        val balance = detail?.balanceMinutes ?: summary!!.balanceMinutes
        val ai = detail?.aiCheckEnabled ?: summary!!.aiCheckEnabled
        val approved = detail?.approvedForSettings ?: summary!!.approvedForSettings

        KidHero(
            name = name,
            grade = detail?.grade ?: summary?.grade,
            bank = balance,
            facts = listOf(
                "Earned today" to (detail?.let { "${it.earnedTodayMinutes}/${it.dailyCapMinutes}" } ?: "-"),
                "Phones" to "${summary?.pairedPhones ?: detail?.phones?.count { it.paired } ?: 0}",
                "Per answer" to (detail?.let { "${it.minutesPerQuestion} min" } ?: "-"),
            ),
        )
        Messages(vm)

        val papers = vm.state?.papers.orEmpty().filter { it.kidId == kidId }
        papers.forEach { p ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Color(0xFFFEF3C7), Color(0xFFFFEDD5)))).clickable { vm.clearMessages(); vm.openPaper(p.id) }.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("📝", style = MaterialTheme.typography.headlineSmall)
                Column(Modifier.weight(1f)) {
                    Text("${p.subject} is waiting", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFF451A03))
                    Text("Tap to check it", style = MaterialTheme.typography.bodySmall, color = Color(0xFF78350F))
                }
                Text("›", style = MaterialTheme.typography.headlineSmall, color = Color(0xFF78350F))
            }
        }

        PillTabs(KID_TABS, tab) { tab = it }

        when (tab) {
            "today" -> {
                Section("🎁  Give bonus time") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        listOf(5, 10, 15, 30).forEach { m ->
                            Button(onClick = { vm.bonus(kidId, m) }, enabled = !vm.busy, modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 4.dp)) { Text("+$m") }
                        }
                    }
                    Text("Bonus minutes do not count toward the daily limit.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                    TextButton(onClick = { moreAmounts = !moreAmounts }) { Text(if (moreAmounts) "Hide" else "Take minutes out…") }
                    if (moreAmounts) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = withdraw,
                                onValueChange = { withdraw = it.filter(Char::isDigit).take(5) },
                                label = { Text("Minutes") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                            )
                            Button(onClick = { vm.withdraw(kidId, withdraw.toInt()); withdraw = "" }, enabled = !vm.busy && (withdraw.toIntOrNull() ?: 0) > 0) { Text("Take out") }
                        }
                        OutlinedButton(onClick = { confirmEmpty = true }, enabled = !vm.busy && balance > 0, modifier = Modifier.fillMaxWidth()) { Text("Empty the bank") }
                    }
                }
                Section("💬  Send a message") {
                    OutlinedTextField(message, { message = it.take(500) }, label = { Text("A note for $name") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                    Button(onClick = { vm.sendMessage(kidId, message); message = "" }, enabled = !vm.busy && message.isNotBlank(), modifier = Modifier.fillMaxWidth().height(48.dp)) { Text("Send") }
                }
            }

            "homework" -> {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    ActionTile("➕", "Add homework", "From a photo or PDF", Modifier.weight(1f), primary = true) { vm.openNewHomework(kidId) }
                    ActionTile("📚", "Results", "Every question", Modifier.weight(1f)) { vm.openResults(kidId) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    ActionTile("📈", "How is it going?", "Strengths and weaknesses", Modifier.weight(1f)) { vm.openPerformance(kidId) }
                    ActionTile("🎯", "Practice", "Questions from the AI", Modifier.weight(1f)) { vm.openPractice(kidId) }
                }
                val sets = detail?.homework.orEmpty()
                if (sets.isNotEmpty()) {
                    Section("Latest homework") {
                        sets.take(3).forEach { s ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("${if (s.kind == "practice") "🎯 " else ""}${s.subject}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Chip("${s.solved}/${s.total} solved", if (s.total > 0 && s.solved == s.total) Tone.Good else Tone.Neutral, bold = true)
                            }
                        }
                        OutlinedButton(onClick = { vm.retryMissed(kidId) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text("Let $name try the missed questions again") }
                    }
                }
                Section("🤖  Paper checking") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Let the kid choose AI checking", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Text(if (ai) "On: the AI can check a paper and add the minutes at once." else "Off: every paper comes to you.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                        }
                        Switch(checked = ai, onCheckedChange = { vm.setAi(kidId, it) }, enabled = !vm.busy)
                    }
                }
            }

            "time" -> {
                Section("⏰  Time windows") {
                    val rules = detail?.schedule.orEmpty()
                    Text("Locked: the phone is off in this time. Free: the phone is free to use without spending minutes.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                    if (detail != null && rules.isEmpty()) Text("No windows yet. Screen time follows the bank only.", style = MaterialTheme.typography.bodyMedium)
                    rules.forEach { r ->
                        Row(
                            Modifier.fillMaxWidth().background(Color(0xFFF8FAFC), RoundedCornerShape(14.dp)).padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Chip(if (r.mode == "blocked") "🔒 Locked" else "🎈 Free", if (r.mode == "blocked") Tone.Bad else Tone.Good, bold = true)
                                Text("${daysLabel(r.days)} · ${formatMinute(r.startMinute)} to ${formatMinute(r.endMinute)}", style = MaterialTheme.typography.bodyMedium)
                            }
                            TextButton(onClick = { vm.deleteRule(kidId, r.id) }, enabled = !vm.busy) { Text("Remove") }
                        }
                    }
                    Button(onClick = { addingRule = true }, modifier = Modifier.fillMaxWidth().height(48.dp)) { Text("Add a time window") }
                }
            }

            else -> {
                Section("📱  Kid's phone") {
                    val phones = detail?.phones.orEmpty().filter { it.paired }
                    Text(if (phones.isEmpty()) "No phone paired yet." else if (phones.size == 1) "1 phone paired." else "${phones.size} phones paired.", style = MaterialTheme.typography.bodyMedium)
                    vm.newCode?.let { code ->
                        Text(code, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        Text("Type this code in the Study Plan kid app. It works once, for 15 minutes.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                    }
                    OutlinedButton(onClick = { vm.pairPhone(kidId) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text(if (vm.newCode == null) "Make a code for the kid's phone" else "Make a new code") }
                }
                Section("🔓  Settings on the kid's phone") {
                    Text(if (approved) "Open for a few minutes." else "Closed. The kid cannot open Settings or uninstall the app.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { vm.allowSettings(kidId, !approved) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) {
                        Text(if (approved) "Close Settings now" else "Allow Settings for 10 minutes")
                    }
                }
                if (detail != null) {
                    Section("🙂  Profile") {
                        Text("Grade ${detail.grade} · ${minutesLabel(detail.minutesPerQuestion)} per answer · up to ${minutesLabel(detail.dailyCapMinutes)} a day", style = MaterialTheme.typography.bodyMedium)
                        Text("Look: ${styleLabel(detail.uiStyle)}", style = MaterialTheme.typography.bodyMedium)
                        Text(if (detail.hasPin) "PIN is set." else "No PIN yet. The kid cannot open the app until you set one.", style = MaterialTheme.typography.bodyMedium)
                        Button(onClick = { vm.openEdit(kidId) }, modifier = Modifier.fillMaxWidth().height(48.dp)) { Text("Edit profile or change the PIN") }
                    }
                }
            }
        }
    }

    if (confirmEmpty) {
        AlertDialog(
            onDismissRequest = { confirmEmpty = false },
            title = { Text("Empty the bank?") },
            text = { Text("All ${minutesLabel(summary?.balanceMinutes ?: detail?.balanceMinutes ?: 0)} are taken out. This cannot be undone.") },
            confirmButton = { TextButton(onClick = { confirmEmpty = false; vm.emptyBank(kidId) }) { Text("Empty it") } },
            dismissButton = { TextButton(onClick = { confirmEmpty = false }) { Text("Cancel") } },
        )
    }
    if (addingRule) {
        RuleDialog(onDismiss = { addingRule = false }) { mode, days, start, end ->
            addingRule = false
            vm.addRule(kidId, mode, days, start, end)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RuleDialog(onDismiss: () -> Unit, onAdd: (mode: String, days: Int, start: String, end: String) -> Unit) {
    var mode by remember { mutableStateOf("blocked") }
    var days by remember { mutableStateOf(setOf(0, 1, 2, 3, 4)) }
    var start by remember { mutableStateOf("21:00") }
    var end by remember { mutableStateOf("07:00") }
    var problem by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add a time window") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = mode == "blocked", onClick = { mode = "blocked" }, label = { Text("Locked") })
                    FilterChip(selected = mode == "free", onClick = { mode = "free" }, label = { Text("Free") })
                }
                Text(if (mode == "blocked") "The phone is locked in this time." else "The phone is free to use in this time, without spending minutes.", style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    DAY_NAMES.forEachIndexed { i, label ->
                        FilterChip(selected = i in days, onClick = { days = if (i in days) days - i else days + i }, label = { Text(label.take(2)) })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(start, { start = it.take(5) }, label = { Text("From") }, singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    OutlinedTextField(end, { end = it.take(5) }, label = { Text("To") }, singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                }
                problem?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                problem = validateRule(days, start, end)
                if (problem == null) onAdd(mode, daysMask(days), start.trim(), end.trim())
            }) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun KidFormScreen(vm: ParentViewModel, kidId: String?) {
    val existing = kidId?.let { id -> vm.kid?.takeIf { it.id == id } }
    if (kidId != null && existing == null) {
        Page {
            TextButton(onClick = { vm.back() }) { Text("← Back") }
            Text(if (vm.busy) "Loading…" else "Could not load this kid.", style = MaterialTheme.typography.bodyLarge)
            Messages(vm)
        }
        return
    }
    var name by rememberSaveable { mutableStateOf(existing?.name ?: "") }
    var grade by rememberSaveable { mutableStateOf(existing?.grade?.toString() ?: "") }
    var perQuestion by rememberSaveable { mutableStateOf(existing?.minutesPerQuestion?.toString() ?: "10") }
    var cap by rememberSaveable { mutableStateOf(existing?.dailyCapMinutes?.toString() ?: "120") }
    var style by rememberSaveable { mutableStateOf(existing?.uiStyle ?: "auto") }
    var pin by rememberSaveable { mutableStateOf("") }
    var problem by remember { mutableStateOf<String?>(null) }

    Page {
        TextButton(onClick = { vm.back() }) { Text("← Back") }
        Text(if (existing == null) "Add a kid" else "Edit ${existing.name}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        OutlinedTextField(name, { name = it.take(60) }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(grade, { grade = it.filter(Char::isDigit).take(2) }, label = { Text("Grade (1 to 12)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(perQuestion, { perQuestion = it.filter(Char::isDigit).take(2) }, label = { Text("Minutes earned per right answer") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(cap, { cap = it.filter(Char::isDigit).take(3) }, label = { Text("Daily limit on earned minutes") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
        Text("Look of the kid's app", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        listOf("auto", "little", "middle", "teen").forEach { s ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.material3.RadioButton(selected = style == s, onClick = { style = s })
                Text(styleLabel(s), style = MaterialTheme.typography.bodyLarge)
            }
        }
        OutlinedTextField(
            pin,
            { pin = it.filter(Char::isDigit).take(4) },
            label = { Text(if (existing == null) "Kid's PIN (4 digits)" else "New PIN (leave empty to keep)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth(),
        )
        (problem ?: vm.error)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }
        Button(
            enabled = !vm.busy,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            onClick = {
                problem = validateKid(name, grade, perQuestion, cap, pin, pinRequired = existing == null)
                if (problem == null) {
                    val profile = KidProfile(name.trim(), grade.toInt(), perQuestion.toInt(), cap.toInt(), style)
                    if (existing == null) vm.createKid(profile, pin) else vm.updateKid(existing.id, profile, pin)
                }
            },
        ) { Text(if (vm.busy) "Saving…" else "Save") }
    }
}

@Composable
fun ResultsScreen(vm: ParentViewModel, kidId: String) {
    val detail = vm.kid?.takeIf { it.id == kidId }
    var removing by remember { mutableStateOf<HomeworkInfo?>(null) }
    removing?.let { set ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Remove ${set.subject}?") },
            text = { Text("The questions and the tries are deleted. Minutes ${detail?.name ?: "the kid"} already earned from it stay in the bank.") },
            confirmButton = { TextButton(onClick = { removing = null; vm.deleteHomework(kidId, set.id) }) { Text("Remove") } },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Cancel") } },
        )
    }
    Page {
        TextButton(onClick = { vm.back() }) { Text("← ${detail?.name ?: "Back"}") }
        Text("Homework and results", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Messages(vm)
        if (detail == null) Text("Loading…", style = MaterialTheme.typography.bodyLarge)
        else if (detail.homework.isEmpty()) Text("No homework yet.", style = MaterialTheme.typography.bodyLarge)
        detail?.homework?.forEach { s ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${if (s.kind == "practice") "🎯 " else ""}${s.subject}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("${s.solved} of ${s.total} solved · ${minutesLabel(s.earnedMinutes)} earned", style = MaterialTheme.typography.bodyMedium)
                    LinearProgressIndicator(progress = { if (s.total == 0) 0f else s.solved.toFloat() / s.total }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(CircleShape))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { vm.openEditHomework(kidId, s) }, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("Edit") }
                        OutlinedButton(onClick = { removing = s }, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("Remove") }
                    }
                }
            }
            s.questions.forEachIndexed { i, q -> QuestionResultCard(i, q) }
            Spacer(Modifier.height(10.dp))
        }
        Button(onClick = { vm.openNewHomework(kidId) }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Add homework from a photo") }
    }
}

private fun newPhotoUri(context: Context): Uri {
    val dir = File(context.cacheDir, "photos").apply { mkdirs() }
    val file = File.createTempFile("sheet", ".jpg", dir)
    return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
}

@Composable
fun NewHomeworkScreen(vm: ParentViewModel, kidId: String) {
    val context = LocalContext.current
    val grade = vm.kid?.takeIf { it.id == kidId }?.grade ?: vm.state?.kids?.firstOrNull { it.id == kidId }?.grade ?: 5
    var subject by rememberSaveable { mutableStateOf("") }
    var pending by rememberSaveable { mutableStateOf<String?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }

    val take = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = pending?.let(Uri::parse)
        pending = null
        if (ok && uri != null) vm.readWorksheet(context, uri, grade)
    }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) vm.readWorksheet(context, uri, grade) }
    val pickPdf = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) vm.readWorksheet(context, uri, grade) }

    Page {
        TextButton(onClick = { vm.back() }) { Text("← Back") }
        Text("Add homework", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Take a photo of the worksheet, or pick a PDF. The AI suggests the questions and answers. Check the answers before you assign it: the kid is graded against them.", style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(subject, { subject = it.take(60) }, label = { Text("Subject, for example Math") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                enabled = !vm.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = { val uri = newPhotoUri(context); pending = uri.toString(); take.launch(uri) },
            ) { Text("Take a photo") }
            OutlinedButton(
                enabled = !vm.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            ) { Text("Gallery") }
            OutlinedButton(
                enabled = !vm.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = { pickPdf.launch(arrayOf("application/pdf")) },
            ) { Text("PDF") }
        }
        if (vm.busy) Text("Reading the worksheet… this can take up to a minute.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        (problem ?: vm.error)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }

        if (vm.drafts.isNotEmpty()) DraftList(vm)
        if (vm.drafts.isNotEmpty()) {
            Button(
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                onClick = {
                    problem = validateHomework(subject, vm.drafts)
                    if (problem == null) vm.assignHomework(kidId, subject)
                },
            ) { Text("Assign ${vm.drafts.count { it.include }} questions") }
        }
    }
}

@Composable
fun EditHomeworkScreen(vm: ParentViewModel, kidId: String, setId: String) {
    var subject by rememberSaveable(setId) { mutableStateOf(vm.kid?.homework?.firstOrNull { it.id == setId }?.subject ?: "") }
    var problem by remember { mutableStateOf<String?>(null) }
    Page {
        TextButton(onClick = { vm.back() }) { Text("← Back") }
        Text("Edit homework", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Change a question or its answer, take a question out (untick it) or add one. Tries the kid already made stay with the questions you keep.", style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(subject, { subject = it.take(60) }, label = { Text("Subject") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        (problem ?: vm.error)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }
        DraftList(vm)
        Button(
            enabled = !vm.busy,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            onClick = {
                problem = validateHomework(subject, vm.drafts)
                if (problem == null) vm.saveHomework(kidId, setId, subject)
            },
        ) { Text(if (vm.busy) "Saving…" else "Save changes") }
    }
}

/** The editable questions plus a way to add one by hand. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DraftList(vm: ParentViewModel) {
    vm.drafts.forEachIndexed { index, d ->
        DraftCard(index, d) { updated -> vm.drafts = vm.drafts.toMutableList().also { it[index] = updated } }
    }
    Text("Add a question", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf("numeric", "short_text", "multiple_choice").forEach { t ->
            FilterChip(selected = false, onClick = { vm.drafts = vm.drafts + blankDraft(t) }, label = { Text(typeLabel(t)) })
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
internal fun DraftCard(index: Int, d: QuestionDraft, onChange: (QuestionDraft) -> Unit) {
    androidx.compose.material3.OutlinedCard(
        Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1)),
        colors = androidx.compose.material3.CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column {
            Row(
                Modifier.fillMaxWidth().background(Color(0xFFF8FAFC)).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                NumberBadge(index + 1)
                Chip(typeLabel(d.type))
                if (!d.include) Chip("Will be removed", Tone.Bad, bold = true)
                Spacer(Modifier.weight(1f))
                androidx.compose.material3.TextButton(onClick = { onChange(d.copy(include = !d.include)) }) { Text(if (d.include) "Remove" else "Keep") }
            }
            if (d.include) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        d.label,
                        { onChange(d.copy(label = it.take(20))) },
                        label = { Text("Number on the paper (optional)") },
                        placeholder = { Text("3, 4b, Exercise 2") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(d.text, { onChange(d.copy(text = it.take(1000))) }, label = { Text("Question") }, modifier = Modifier.fillMaxWidth())
                    Column(
                        Modifier.fillMaxWidth().background(Tone.Good.container.copy(alpha = 0.5f), androidx.compose.foundation.shape.RoundedCornerShape(12.dp)).padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (d.type == "multiple_choice") {
                            var optionsText by remember(d.id, index) { mutableStateOf(d.options.orEmpty().joinToString(", ")) }
                            OutlinedTextField(
                                optionsText,
                                { optionsText = it; onChange(d.copy(options = parseOptions(it), answerKey = if (d.answerKey.trim() in parseOptions(it)) d.answerKey else "")) },
                                label = { Text("Options, separated by commas") },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Text("Right answer", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = Tone.Good.content)
                            androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                d.options.orEmpty().forEach { o ->
                                    FilterChip(selected = d.answerKey.trim() == o.trim(), onClick = { onChange(d.copy(answerKey = o)) }, label = { Text(o) })
                                }
                            }
                        } else {
                            OutlinedTextField(
                                d.answerKey,
                                { onChange(d.copy(answerKey = it.take(500))) },
                                label = { Text(if (d.type == "numeric") "Right answer (a number)" else "Right answer") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = if (d.type == "numeric") KeyboardType.Decimal else KeyboardType.Text),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        }
    }
}
