package com.studyplan.parent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** Splits "fractions, subtraction" into topics. */
fun parseFocus(text: String): List<String> = text.split(',', '\n').map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(5)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeScreen(vm: ParentViewModel, kidId: String) {
    val detail = vm.kid?.takeIf { it.id == kidId }
    val name = detail?.name ?: vm.state?.kids?.firstOrNull { it.id == kidId }?.name ?: "your kid"
    var count by rememberSaveable { mutableIntStateOf(5) }
    var focus by rememberSaveable { mutableStateOf("") }
    var problem by remember { mutableStateOf<String?>(null) }
    var mode by remember(detail?.autoPractice) { mutableStateOf(detail?.autoPractice ?: "off") }
    var size by remember(detail?.autoPracticeSize) { mutableIntStateOf(detail?.autoPracticeSize ?: 5) }

    Page {
        TextButton(onClick = { vm.back() }) { Text("← Back") }
        Text("Practice questions", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("The AI makes new questions like the ones $name found hard (${periodLabel(vm.period).lowercase()}). You check them, then send them when the time feels right.", style = MaterialTheme.typography.bodyMedium)
        Messages(vm)

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("How many", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(3, 5, 7, 10).forEach { n -> FilterChip(selected = count == n, onClick = { count = n }, label = { Text("$n") }) }
                }
                OutlinedTextField(focus, { focus = it.take(200) }, label = { Text("Topics to practise (optional)") }, placeholder = { Text("fractions, subtraction") }, modifier = Modifier.fillMaxWidth())
                Button(onClick = { vm.makePractice(kidId, count, parseFocus(focus)) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text(if (vm.busy && vm.drafts.isEmpty()) "The AI is writing…" else "Make questions")
                }
            }
        }

        if (vm.drafts.isNotEmpty()) {
            Text("Check every answer before you send. $name is marked against these answers and earns minutes for right ones.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            OutlinedTextField(vm.practiceSubject, { vm.practiceSubject = it.take(60) }, label = { Text("Name of the set") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            DraftList(vm)
            (problem ?: vm.error)?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyLarge) }
            Button(
                onClick = {
                    problem = validateHomework(vm.practiceSubject, vm.drafts)
                    if (problem == null) vm.sendPractice(kidId)
                },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text("Send ${vm.drafts.count { it.include }} questions to $name") }
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Let the AI send practice by itself", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("A short practice set is added between the daily homework, from recent mistakes. It waits until $name has finished the last practice, and you are told when one is added.", style = MaterialTheme.typography.bodyMedium)
                AUTO_MODES.forEach { m -> FilterChip(selected = mode == m, onClick = { mode = m }, label = { Text(autoLabel(m)) }) }
                Text("Questions in each set", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(3, 5, 7, 10).forEach { n -> FilterChip(selected = size == n, onClick = { size = n }, label = { Text("$n") }) }
                }
                Button(onClick = { vm.saveAutoPractice(kidId, mode, size) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth()) { Text("Save") }
            }
        }
    }
}
