package com.studyplan.parent

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** The colors a small label can have. */
enum class Tone(val container: Color, val content: Color) {
    Good(Color(0xFFD1FAE5), Color(0xFF065F46)),
    Bad(Color(0xFFFEE2E2), Color(0xFF991B1B)),
    Warn(Color(0xFFFEF3C7), Color(0xFF92400E)),
    Neutral(Color(0xFFF1F5F9), Color(0xFF475569)),
}

fun statusTone(status: String): Tone = when (status) {
    "solved" -> Tone.Good
    "failed" -> Tone.Bad
    "in_progress" -> Tone.Warn
    else -> Tone.Neutral
}

/** A small rounded label. */
@Composable
fun Chip(text: String, tone: Tone = Tone.Neutral, bold: Boolean = false) {
    Box(Modifier.background(tone.container, CircleShape).padding(horizontal = 12.dp, vertical = 5.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium, color = tone.content)
    }
}

/** The round number in front of a question. */
@Composable
fun NumberBadge(n: Int) {
    Box(Modifier.size(32.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
        Text("$n", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
    }
}

/** One question with the right answer and every try, as its own card so questions never run together. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun QuestionResultCard(index: Int, q: QuestionResultInfo) {
    OutlinedCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color(0xFFCBD5E1)), colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column {
            Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                NumberBadge(index + 1)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(q.text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Chip("Answer: ${q.answerKey}", Tone.Good, bold = true)
                        Chip(statusLabel(q.status), statusTone(q.status), bold = true)
                        if (q.earnedMinutes > 0) Chip("+${q.earnedMinutes} min", Tone.Good)
                    }
                    if (q.options != null && q.options.isNotEmpty()) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            q.options.forEach { o -> Chip(o, if (o == q.answerKey) Tone.Good else Tone.Neutral) }
                        }
                    }
                }
            }
            Box(Modifier.fillMaxWidth().background(Color(0xFFF8FAFC)).padding(horizontal = 14.dp, vertical = 10.dp)) {
                if (q.attempts.isEmpty()) {
                    Text("Not tried yet", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF64748B))
                } else {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                        Text("Tries", style = MaterialTheme.typography.labelMedium, color = Color(0xFF64748B))
                        q.attempts.forEach { t -> Chip("${if (t.correct) "✓" else "✗"} ${t.answer}", if (t.correct) Tone.Good else Tone.Bad) }
                    }
                }
            }
        }
    }
}
