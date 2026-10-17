package com.studyplan.parent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private fun levelColor(accuracy: Int?): Color = when (levelOf(accuracy)) {
    "good" -> Color(0xFF10B981)
    "fair" -> Color(0xFFF59E0B)
    "low" -> Color(0xFFEF4444)
    else -> Color(0xFFCBD5E1)
}

@Composable
private fun PercentBar(value: Int?) {
    Box(Modifier.fillMaxWidth().height(12.dp).clip(CircleShape).background(Color(0xFFE2E8F0))) {
        Box(Modifier.fillMaxWidth((value ?: 0) / 100f).height(12.dp).clip(CircleShape).background(levelColor(value)))
    }
}

@Composable
private fun Block(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
fun AssessmentCard(a: AssessmentInfo) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(a.summary, style = MaterialTheme.typography.bodyLarge)
        if (a.strengths.isNotEmpty()) {
            Text("Strengths", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color(0xFF047857))
            a.strengths.forEach { (topic, evidence) -> Text("$topic. $evidence", style = MaterialTheme.typography.bodyMedium) }
        }
        if (a.weaknesses.isNotEmpty()) {
            Text("Needs practice", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color(0xFFBE123C))
            a.weaknesses.forEach { (topic, evidence) -> Text("$topic. $evidence", style = MaterialTheme.typography.bodyMedium) }
        }
        if (a.recommendations.isNotEmpty()) {
            Text("What you can do", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            a.recommendations.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
        }
        if (a.encouragement.isNotBlank()) {
            Box(Modifier.fillMaxWidth().background(Color(0xFFFEF3C7), RoundedCornerShape(12.dp)).padding(12.dp)) {
                Text("You could say: \"${a.encouragement}\"", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF451A03))
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PerformanceScreen(vm: ParentViewModel, kidId: String) {
    val data = vm.performance
    val kidName = vm.kid?.takeIf { it.id == kidId }?.name ?: vm.state?.kids?.firstOrNull { it.id == kidId }?.name ?: "your kid"
    Page {
        TextButton(onClick = { vm.back() }) { Text("← $kidName") }
        Text("How is it going?", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("week", "month", "year").forEach { p ->
                FilterChip(selected = vm.period == p, onClick = { vm.openPerformance(kidId, p) }, label = { Text(periodLabel(p)) })
            }
        }
        Messages(vm)
        if (data == null) {
            Text(if (vm.busy) "Loading…" else "Could not load the results.", style = MaterialTheme.typography.bodyLarge)
            return@Page
        }
        val t = data.stats.totals
        if (t.attempts == 0) {
            Text("No answers in this period yet. When $kidName answers homework, the numbers show up here.", style = MaterialTheme.typography.bodyLarge)
        } else {
            Block("The numbers") {
                Text("${t.questions} questions, ${t.solved} solved, ${t.failed} out of tries", style = MaterialTheme.typography.bodyLarge)
                Text("Right first time: ${t.firstTryRate?.let { "$it%" } ?: "-"}", style = MaterialTheme.typography.bodyLarge)
                Text("Tries that were right: ${t.accuracy?.let { "$it%" } ?: "-"}", style = MaterialTheme.typography.bodyLarge)
                PercentBar(t.accuracy)
                Text("${minutesLabel(t.earnedMinutes)} earned, ${t.papersChecked} papers checked", style = MaterialTheme.typography.bodyMedium)
            }
            if (data.stats.subjects.isNotEmpty()) {
                Block("By subject") {
                    data.stats.subjects.forEach { s ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(s.subject, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                Text("${s.accuracy?.let { "$it%" } ?: "-"} · ${s.solved}/${s.questions} solved", style = MaterialTheme.typography.bodyMedium)
                            }
                            PercentBar(s.accuracy)
                        }
                    }
                }
            }
            if (data.stats.hardest.isNotEmpty()) {
                Block("Hardest questions") {
                    data.stats.hardest.take(6).forEach { h ->
                        Column {
                            Text(h.text, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                            Text("${h.subject} · answer: ${h.answerKey} · ${if (h.solved) "solved" else "not solved"} · ${h.tries} tries", style = MaterialTheme.typography.bodySmall)
                            if (h.wrongAnswers.isNotEmpty()) Text("Wrote: ${h.wrongAnswers.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            val latest = data.reports.firstOrNull { it.period == vm.period }
            Block("AI assessment") {
                Text("The AI reads the results and the questions from this period and tells you the strengths and weaknesses.", style = MaterialTheme.typography.bodyMedium)
                Button(onClick = { vm.assess(kidId) }, enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                    Text(if (vm.busy) "The AI is reading the results…" else "Assess performance with AI")
                }
                latest?.assessment?.let {
                    HorizontalDivider()
                    AssessmentCard(it)
                }
            }
            val earlier = data.reports.filter { it !== data.reports.firstOrNull { r -> r.period == vm.period } && it.assessment != null }.take(4)
            if (earlier.isNotEmpty()) {
                Block("Earlier assessments") {
                    earlier.forEach { r ->
                        Text("${periodLabel(r.period)} · ${r.createdAt.take(10)} · ${r.accuracy?.let { "$it% right" } ?: ""}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        r.assessment?.let { Text(it.summary, style = MaterialTheme.typography.bodySmall) }
                    }
                }
            }
        }
    }
}
