package com.studyplan.parent

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File

private val cardGap = Arrangement.spacedBy(10.dp)

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = cardGap) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
fun KidScreen(vm: ParentViewModel, kidId: String) {
    val summary = vm.state?.kids?.firstOrNull { it.id == kidId }
    val detail = vm.kid?.takeIf { it.id == kidId }
    var withdraw by rememberSaveable { mutableStateOf("") }
    var confirmEmpty by remember { mutableStateOf(false) }
    var addingRule by remember { mutableStateOf(false) }

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

        Text(name, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(minutesLabel(balance) + " in the bank", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        detail?.let { Text("Earned today: ${minutesLabel(it.earnedTodayMinutes)} of ${minutesLabel(it.dailyCapMinutes)} a day", style = MaterialTheme.typography.bodyMedium) }
        Messages(vm)

        val papers = vm.state?.papers.orEmpty().filter { it.kidId == kidId }
        if (papers.isNotEmpty()) {
            Section("Papers to check") {
                papers.forEach { p -> OutlinedButton(onClick = { vm.clearMessages(); vm.openPaper(p.id) }, modifier = Modifier.fillMaxWidth()) { Text(p.subject) } }
            }
        }

        Section("Homework") {
            val sets = detail?.homework.orEmpty()
            if (detail == null) Text("Loading…", style = MaterialTheme.typography.bodyMedium)
            else if (sets.isEmpty()) Text("No homework yet. Take a photo of a worksheet to add some.", style = MaterialTheme.typography.bodyMedium)
            sets.take(3).forEach { s -> Text("${s.subject}: ${s.solved} of ${s.total} solved", style = MaterialTheme.typography.bodyLarge) }
            Button(onClick = { vm.openNewHomework(kidId) }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Add homework from a photo") }
            if (sets.isNotEmpty()) OutlinedButton(onClick = { vm.openResults(kidId) }, modifier = Modifier.fillMaxWidth()) { Text("See every question and try") }
        }

        var message by rememberSaveable { mutableStateOf("") }
        Section("Message") {
            OutlinedTextField(message, { message = it.take(500) }, label = { Text("A note for $name") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            Button(onClick = { vm.sendMessage(kidId, message); message = "" }, enabled = !vm.busy && message.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Send") }
        }

        Section("Give bonus time") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                listOf(5, 10, 15, 30).forEach { m ->
                    Button(onClick = { vm.bonus(kidId, m) }, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("+$m") }
                }
            }
            Text("Bonus minutes do not count toward the daily limit.", style = MaterialTheme.typography.bodySmall)
        }

        Section("Take minutes out of the bank") {
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

        Section("Time windows") {
            val rules = detail?.schedule.orEmpty()
            if (detail != null && rules.isEmpty()) Text("No locked or free times. Screen time follows the bank only.", style = MaterialTheme.typography.bodyMedium)
            rules.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(ruleLabel(r.mode, r.days, r.startMinute, r.endMinute), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    TextButton(onClick = { vm.deleteRule(kidId, r.id) }, enabled = !vm.busy) { Text("Remove") }
                }
            }
            OutlinedButton(onClick = { addingRule = true }, modifier = Modifier.fillMaxWidth()) { Text("Add a time window") }
            Text("Locked: the phone is locked in this time. Free: the phone can be used without spending minutes.", style = MaterialTheme.typography.bodySmall)
        }

        Section("Kid's phone") {
            val phones = detail?.phones.orEmpty().filter { it.paired }
            Text(if (phones.isEmpty()) "No phone paired yet." else if (phones.size == 1) "1 phone paired." else "${phones.size} phones paired.", style = MaterialTheme.typography.bodyMedium)
            vm.newCode?.let { code ->
                Text(code, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("Type this code in the Study Plan kid app. It works once, for 15 minutes.", style = MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick = { vm.pairPhone(kidId) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text(if (vm.newCode == null) "Make a code for the kid's phone" else "Make a new code") }
        }

        Section("Checking and Settings") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Let the kid choose AI checking", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(if (ai) "On: the AI can check a paper and add the minutes at once." else "Off: every paper comes to you.", style = MaterialTheme.typography.bodyMedium)
                }
                Switch(checked = ai, onCheckedChange = { vm.setAi(kidId, it) }, enabled = !vm.busy)
            }
            HorizontalDivider()
            Text("Settings on the kid's phone", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(if (approved) "Open for a few minutes." else "Closed. The kid cannot open Settings or uninstall the app.", style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = { vm.allowSettings(kidId, !approved) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) {
                Text(if (approved) "Close Settings now" else "Allow Settings for 10 minutes")
            }
        }

        if (detail != null) {
            Section("Profile") {
                Text("Grade ${detail.grade} · ${minutesLabel(detail.minutesPerQuestion)} per answer · up to ${minutesLabel(detail.dailyCapMinutes)} a day", style = MaterialTheme.typography.bodyMedium)
                Text("Look: ${styleLabel(detail.uiStyle)}", style = MaterialTheme.typography.bodyMedium)
                Text(if (detail.hasPin) "PIN is set." else "No PIN yet. The kid cannot open the app until you set one.", style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = { vm.openEdit(kidId) }, modifier = Modifier.fillMaxWidth()) { Text("Edit profile or change the PIN") }
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
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${s.subject}: ${s.solved} of ${s.total} solved", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Earned ${minutesLabel(s.earnedMinutes)}", style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { vm.openEditHomework(kidId, s) }, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("Edit") }
                        OutlinedButton(onClick = { removing = s }, enabled = !vm.busy, modifier = Modifier.weight(1f)) { Text("Remove") }
                    }
                    HorizontalDivider()
                    s.questions.forEachIndexed { i, q ->
                        Column {
                            Text("${i + 1}. ${q.text}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                            Text("Answer: ${q.answerKey}", style = MaterialTheme.typography.bodyMedium)
                            Text("${statusLabel(q.status)} · ${if (q.tries == 1) "1 try" else "${q.tries} tries"}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
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
private fun DraftList(vm: ParentViewModel) {
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DraftCard(index: Int, d: QuestionDraft, onChange: (QuestionDraft) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = d.include, onCheckedChange = { onChange(d.copy(include = it)) })
                Text(if (d.include) "Question ${index + 1}" else "Question ${index + 1} (will be removed)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            if (d.include) {
                OutlinedTextField(d.text, { onChange(d.copy(text = it.take(1000))) }, label = { Text("Question") }, modifier = Modifier.fillMaxWidth())
                if (d.type == "multiple_choice") {
                    var optionsText by remember(d.id, index) { mutableStateOf(d.options.orEmpty().joinToString(", ")) }
                    OutlinedTextField(
                        optionsText,
                        { optionsText = it; onChange(d.copy(options = parseOptions(it), answerKey = if (d.answerKey.trim() in parseOptions(it)) d.answerKey else "")) },
                        label = { Text("Options, separated by commas") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("Right answer:", style = MaterialTheme.typography.bodyMedium)
                    d.options.orEmpty().forEach { o ->
                        FilterChip(selected = d.answerKey.trim() == o.trim(), onClick = { onChange(d.copy(answerKey = o)) }, label = { Text(o) })
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
