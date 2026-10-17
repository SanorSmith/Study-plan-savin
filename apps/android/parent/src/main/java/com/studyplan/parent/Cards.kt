package com.studyplan.parent

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clip
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
    Info(Color(0xFFE0F2FE), Color(0xFF075985)),
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
                        if (!q.label.isNullOrBlank()) Chip("On the paper: ${q.label}", Tone.Info, bold = true)
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

private val Violet = Color(0xFF6C4CF1)
private val Indigo = Color(0xFF4F46E5)
private val Sky = Color(0xFF0EA5E9)

/** The soft white card every section sits on. */
@Composable
fun SoftCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable () -> Unit) {
    val colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = Color.White)
    val shape = RoundedCornerShape(20.dp)
    val elevation = androidx.compose.material3.CardDefaults.cardElevation(defaultElevation = 2.dp)
    if (onClick != null) {
        androidx.compose.material3.Card(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = shape, colors = colors, elevation = elevation) { content() }
    } else {
        androidx.compose.material3.Card(modifier = modifier.fillMaxWidth(), shape = shape, colors = colors, elevation = elevation) { content() }
    }
}

/** A colored circle with the kid's first letter. The color follows the name, so each kid keeps theirs. */
@Composable
fun KidAvatar(name: String, size: androidx.compose.ui.unit.Dp = 48.dp) {
    val palettes = listOf(
        listOf(Color(0xFF8B5CF6), Color(0xFFD946EF)),
        listOf(Color(0xFF0EA5E9), Color(0xFF6366F1)),
        listOf(Color(0xFF10B981), Color(0xFF14B8A6)),
        listOf(Color(0xFFFBBF24), Color(0xFFF97316)),
        listOf(Color(0xFFF43F5E), Color(0xFFEC4899)),
    )
    val colors = palettes[name.sumOf { it.code } % palettes.size]
    Box(Modifier.size(size).background(androidx.compose.ui.graphics.Brush.linearGradient(colors), CircleShape), contentAlignment = Alignment.Center) {
        Text(name.trim().take(1).uppercase().ifEmpty { "?" }, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
    }
}

/** The colorful header of a kid's page: who, how many minutes, and three small facts. */
@Composable
fun KidHero(name: String, grade: Int?, bank: Int, facts: List<Pair<String, String>>) {
    Column(
        Modifier.fillMaxWidth().background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Violet, Indigo, Sky)), RoundedCornerShape(28.dp)).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            KidAvatar(name, 56.dp)
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1)
                if (grade != null) Text(gradeLabel(grade), style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.85f))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("$bank", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = Color.White)
                Text("min in the bank", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.85f))
            }
        }
        if (facts.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                facts.forEach { (label, value) ->
                    Column(
                        Modifier.weight(1f).background(Color.White.copy(alpha = 0.18f), RoundedCornerShape(16.dp)).padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(label, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f))
                        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            }
        }
    }
}

/** A big tappable tile with an emoji, a title and one line of text. The main one is colored. */
@Composable
fun ActionTile(icon: String, title: String, text: String, modifier: Modifier = Modifier, primary: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    val background = if (primary) Modifier.background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Violet, Indigo)), shape) else Modifier.background(Color.White, shape)
    Column(
        modifier.clip(shape).then(background).clickable(onClick = onClick).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(icon, style = MaterialTheme.typography.headlineMedium)
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = if (primary) Color.White else Color(0xFF0F172A))
        Text(text, style = MaterialTheme.typography.bodySmall, color = if (primary) Color.White.copy(alpha = 0.85f) else Color(0xFF64748B))
    }
}

/** A row of pill tabs. The chosen one is filled with the brand color. */
@Composable
fun PillTabs(tabs: List<Triple<String, String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(20.dp)).padding(5.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        tabs.forEach { (id, icon, label) ->
            val on = id == selected
            val shape = RoundedCornerShape(16.dp)
            Column(
                Modifier.weight(1f).clip(shape)
                    .then(if (on) Modifier.background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Violet, Indigo)), shape) else Modifier)
                    .clickable { onSelect(id) }
                    .padding(vertical = 9.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(icon, style = MaterialTheme.typography.titleMedium)
                Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = if (on) Color.White else Color(0xFF475569))
            }
        }
    }
}
