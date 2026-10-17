package com.studyplan.parent

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
internal fun Page(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) { content() }
}

@Composable
internal fun Messages(vm: ParentViewModel) {
    vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }
    vm.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold) }
}

@Composable
fun PairScreen(vm: ParentViewModel) {
    var code by rememberSaveable { mutableStateOf("") }
    Page {
        Spacer(Modifier.height(32.dp))
        Text("Study Plan Parent", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text("Check your kids' homework papers and give or take screen time, right from your phone.", style = MaterialTheme.typography.bodyLarge)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Connect this phone", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("1. Open the Study Plan website and sign in.\n2. On the dashboard, under Parent app for Android, tap New code.\n3. Type the code here.", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = cleanCode(it) },
                    label = { Text("Code") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
                    modifier = Modifier.fillMaxWidth(),
                )
                Button(onClick = { vm.pair(code) }, enabled = code.length >= 4 && !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text(if (vm.busy) "Connecting…" else "Connect")
                }
            }
        }
        Messages(vm)
    }
}

@Composable
fun HomeScreen(vm: ParentViewModel) {
    val state = vm.state
    var confirmSignOut by remember { mutableStateOf(false) }
    Page {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Study Plan", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
            TextButton(onClick = { vm.refresh() }, enabled = !vm.busy) { Text(if (vm.busy) "…" else "Refresh") }
        }
        Messages(vm)

        if (state == null) {
            Text(if (vm.busy) "Loading…" else "Nothing loaded yet. Tap Refresh.", style = MaterialTheme.typography.bodyLarge)
        } else {
            if (state.papers.isNotEmpty()) {
                Text("Papers to check", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                state.papers.forEach { p ->
                    Card(Modifier.fillMaxWidth().clickable { vm.clearMessages(); vm.openPaper(p.id) }) {
                        Column(Modifier.padding(16.dp)) {
                            Text("${p.kidName}: ${p.subject}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text("Tap to look at the photos and check it", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
            Text("Your kids", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (state.kids.isEmpty()) {
                Text("No kids yet. Add your first kid.", style = MaterialTheme.typography.bodyLarge)
            }
            state.kids.forEach { k ->
                Card(Modifier.fillMaxWidth().clickable { vm.openKid(k.id) }) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(k.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text(gradeLabel(k.grade), style = MaterialTheme.typography.bodyMedium)
                        }
                        Text(minutesLabel(k.balanceMinutes) + " in the bank", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        val notes = buildList {
                            if (k.papersToReview > 0) add("${k.papersToReview} to check")
                            if (k.pairedPhones == 0) add("no phone paired")
                            if (k.aiCheckEnabled) add("AI checking on")
                        }
                        if (notes.isNotEmpty()) Text(notes.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        if (state != null) {
            Button(onClick = { vm.clearMessages(); vm.screen = Screen.AddKid }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Add a kid") }
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = { confirmSignOut = true }) { Text("Disconnect this phone") }
    }
    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Disconnect this phone?") },
            text = { Text("You will stop getting notifications. You can connect again with a new code from the website.") },
            confirmButton = { TextButton(onClick = { confirmSignOut = false; vm.signOut() }) { Text("Disconnect") } },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } },
        )
    }
}

@Composable
fun PaperScreen(vm: ParentViewModel, paperId: String) {
    val paper = vm.paper?.takeIf { it.id == paperId }
    var ticks by remember(paper?.id, vm.paperVersion) { mutableStateOf(paper?.let { startingTicks(it.answers, it.aiRead) } ?: emptySet()) }
    var enlarged by remember { mutableStateOf<Int?>(null) }
    Page {
        TextButton(onClick = { vm.goHome() }) { Text("← Back") }
        if (paper == null) {
            Text(if (vm.busy) "Loading the paper…" else "Could not load this paper.", style = MaterialTheme.typography.bodyLarge)
            Messages(vm)
            return@Page
        }
        Text("${paper.kidName}: ${paper.subject}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Messages(vm)

        val pending = paper.status == "pending"
        if (!pending) {
            val how = when {
                paper.status == "rejected" -> "This paper was sent back."
                paper.autoApproved -> "The AI checked this paper. ${minutesLabel(paper.awardedMinutes)} were added."
                else -> "You approved this paper. ${minutesLabel(paper.awardedMinutes)} were added."
            }
            Text(how, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        } else {
            Text(
                if (paper.aiRead) "The AI read the paper and ticked what looks right. Check it against the photos." else "Look at the photos, then tick every answer that is right.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        if (paper.imageCount == 0) {
            Text("The photos have been deleted (they are kept for 14 days).", style = MaterialTheme.typography.bodyMedium)
        }
        vm.photos.forEachIndexed { i, bmp ->
            if (bmp == null) {
                Text("Loading photo ${i + 1}…", style = MaterialTheme.typography.bodyMedium)
            } else {
                Image(
                    bitmap = bmp.asImageBitmap(),
                    contentDescription = "Photo ${i + 1} of the paper",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().clickable { enlarged = i },
                )
            }
        }
        if (vm.photos.isNotEmpty()) Text("Tap a photo to see it bigger.", style = MaterialTheme.typography.bodySmall)

        paper.answers.forEachIndexed { index, a ->
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                    if (pending && !a.alreadySolved) {
                        Checkbox(checked = a.questionId in ticks, onCheckedChange = { on -> ticks = if (on) ticks + a.questionId else ticks - a.questionId })
                    } else {
                        Spacer(Modifier.padding(start = 12.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("${index + 1}. ${a.text}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                        Text("Right answer: ${a.answerKey}", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "On paper: " + (a.readAnswer ?: if (paper.aiRead) "could not read it" else "not read yet"),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        a.note?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        if (a.alreadySolved) Text("Already solved in the app", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                        if (!pending && !a.alreadySolved) {
                            Text(if (a.finalCorrect == true) "Counted as right" else "Not counted", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }

        var note by remember(paper.id) { mutableStateOf("") }
        if (pending) {
            Text("Reply to ${paper.kidName} (optional)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Great job! 🌟", "Look at the red ones again", "Let's practice").forEach { q ->
                    androidx.compose.material3.AssistChip(onClick = { note = q }, label = { Text(q, style = MaterialTheme.typography.labelSmall) })
                }
            }
            OutlinedTextField(note, { note = it.take(500) }, label = { Text("Message to ${paper.kidName}") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            val count = ticks.size
            Button(onClick = { vm.decide(paper.id, ticks, note) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                Text(if (vm.busy) "…" else if (count == 0) "Approve, nothing counted" else "Approve ($count counted)")
            }
            OutlinedButton(onClick = { vm.decide(paper.id, null, note) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Send back, no minutes") }
            OutlinedButton(onClick = { vm.askAi(paper.id) }, enabled = !vm.busy && paper.imageCount > 0, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text(if (vm.busy) "Working…" else if (paper.aiRead) "Ask the AI again" else "Ask the AI for suggestions")
            }
            Text("The photos are only sent to the AI when you tap this.", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }

    enlarged?.let { i ->
        vm.photos.getOrNull(i)?.let { bmp -> ZoomDialog(bmp) { enlarged = null } }
    }
}
