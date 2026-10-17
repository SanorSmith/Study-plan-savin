package com.studyplan.kid

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** The page behind everything: a soft gradient for young kids, a flat color for teens. */
@Composable
fun PageBackground(content: @Composable () -> Unit) {
    val look = LocalLook.current
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(look.pageStart, look.pageEnd)))) { content() }
}

/** A white rounded card in the age's shape. */
@Composable
fun LookCard(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val look = LocalLook.current
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(look.corner),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Column(Modifier.padding(if (look.band == AgeBand.Little) 22.dp else 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { content() }
    }
}

/** The big colored card with the time ring: a bright gradient with white text. */
@Composable
fun HeroCard(modifier: Modifier = Modifier, compact: Boolean = false, content: @Composable () -> Unit) {
    val look = LocalLook.current
    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(look.corner * 1.2f))
            .background(Brush.linearGradient(look.hero))
            .padding(if (compact) 12.dp else 20.dp),
    ) {
        CompositionLocalProvider(LocalContentColor provides Color.White) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
        }
    }
}

/** A small rounded label, such as the subject. */
@Composable
fun InfoPill(text: String) {
    Box(Modifier.background(MaterialTheme.colorScheme.primaryContainer, CircleShape).padding(horizontal = 14.dp, vertical = 6.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onPrimaryContainer)
    }
}

/** A ring showing how many minutes are left (a full ring is an hour or more). */
@Composable
fun TimeGauge(minutes: Int, unit: String, showEmoji: Boolean, compact: Boolean = false) {
    val progress by animateFloatAsState((minutes / 60f).coerceIn(0f, 1f), animationSpec = tween(700), label = "gauge")
    val track = Color.White.copy(alpha = 0.3f)
    val arc = Color.White
    Box(
        Modifier.size(if (compact) 118.dp else 176.dp).semantics { contentDescription = "$minutes $unit left" },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = (if (compact) 10.dp else 14.dp).toPx()
            val inset = stroke / 2
            val sizePx = Size(size.width - stroke, size.height - stroke)
            drawArc(track, 0f, 360f, false, Offset(inset, inset), sizePx, style = Stroke(stroke))
            drawArc(arc, -90f, 360f * progress, false, Offset(inset, inset), sizePx, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (showEmoji && !compact) Text("🕒", fontSize = 26.sp)
            Text("$minutes", style = if (compact) MaterialTheme.typography.headlineLarge else MaterialTheme.typography.displayMedium, fontWeight = FontWeight.Black, color = Color.White)
            Text(unit, style = MaterialTheme.typography.labelLarge, color = Color.White.copy(alpha = 0.85f))
        }
    }
}

/** Stars for young kids, a bar for older ones. */
@Composable
fun HomeworkProgress(done: Int, total: Int) {
    if (total <= 0) return
    val look = LocalLook.current
    if (look.band == AgeBand.Little) {
        Text(
            (0 until minOf(total, 10)).joinToString(" ") { if (it < done) "⭐" else "☆" },
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "$done of $total done" },
            textAlign = TextAlign.Center,
            fontSize = 28.sp,
        )
    } else {
        Row(Modifier.fillMaxWidth().semantics { contentDescription = "$done of $total done" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LinearProgressIndicator(
                progress = { done.toFloat() / total },
                modifier = Modifier.weight(1f).height(12.dp).clip(CircleShape),
                color = look.hero[1],
                trackColor = MaterialTheme.colorScheme.primaryContainer,
            )
            Text("$done/$total", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
        }
    }
}

/** An on-screen number pad. Used for answers by young kids and for the PIN by everyone. */
@Composable
fun Keypad(onKey: (String) -> Unit, allowDecimal: Boolean, enabled: Boolean = true) {
    val look = LocalLook.current
    val height = if (look.bigKeypad) 60.dp else 52.dp
    val rows = listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf(if (allowDecimal) "." else "", "0", "⌫"))
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { key ->
                    if (key.isEmpty()) {
                        Spacer(Modifier.weight(1f))
                    } else {
                        FilledTonalButton(
                            onClick = { onKey(key) },
                            enabled = enabled,
                            modifier = Modifier.weight(1f).height(height).semantics { contentDescription = if (key == "⌫") "Delete" else key },
                            shape = RoundedCornerShape(look.corner * 0.7f),
                        ) {
                            Text(key, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
            }
        }
    }
}

/** Dots that fill up as the PIN is typed. */
@Composable
fun PinDots(length: Int, filled: Int) {
    Row(
        Modifier.fillMaxWidth().semantics { contentDescription = "$filled of $length digits entered" },
        horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally),
    ) {
        repeat(length) { i ->
            val color = MaterialTheme.colorScheme.primary
            Box(Modifier.size(22.dp).clip(CircleShape).background(if (i < filled) color else color.copy(alpha = 0.18f)))
        }
    }
}

/** The answer choices: each a different bright color. Teens get white buttons with a colored edge. */
@Composable
fun AnswerOptions(options: List<String>, enabled: Boolean, onPick: (String) -> Unit) {
    val look = LocalLook.current
    val teen = look.band == AgeBand.Teen
    Column(verticalArrangement = Arrangement.spacedBy(if (look.band == AgeBand.Little) 12.dp else 10.dp)) {
        options.forEachIndexed { index, option ->
            val i = index % look.options.size
            Button(
                onClick = { onPick(option) },
                enabled = enabled,
                modifier = Modifier.fillMaxWidth().heightIn(min = if (look.band == AgeBand.Little) 64.dp else 52.dp),
                shape = RoundedCornerShape(look.corner * 0.7f),
                border = if (teen) BorderStroke(2.dp, look.options[i]) else null,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (teen) Color.White else look.options[i],
                    contentColor = if (teen) look.optionText[i] else look.optionText[i],
                    disabledContainerColor = (if (teen) Color.White else look.options[i]).copy(alpha = 0.5f),
                ),
            ) {
                Text(option, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp))
            }
        }
    }
}

/** A burst of emoji with a short pop when an answer is right. */
@Composable
fun CelebrationOverlay(emoji: String, text: String) {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val scale by animateFloatAsState(if (shown) 1f else 0.6f, spring(dampingRatio = Spring.DampingRatioMediumBouncy), label = "pop")
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Surface(
            modifier = Modifier.scale(scale).padding(24.dp),
            shape = RoundedCornerShape(32.dp),
            color = Color.White,
            shadowElevation = 16.dp,
        ) {
            Column(Modifier.padding(horizontal = 28.dp, vertical = 22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (emoji.isNotEmpty()) Text(emoji, fontSize = 48.sp, textAlign = TextAlign.Center)
                Text(text, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black, color = Color(0xFF6C4CF1), textAlign = TextAlign.Center)
            }
        }
    }
}
