package com.studyplan.kid

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** What the kid sees above a question: the number from the worksheet, or the place in the homework. Mirrors the web app. */
fun questionTitle(label: String?, position: Int): String {
    val l = label?.trim().orEmpty()
    if (l.isEmpty()) return "Question $position"
    return if (l.first().isDigit()) "Question $l" else l
}

/** A "Need a hint?" button. The AI explains the method, never the answer. Keyed by the question, so a new question starts fresh. */
@Composable
fun HintBox(questionId: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var hint by remember(questionId) { mutableStateOf<String?>(null) }
    var loading by remember(questionId) { mutableStateOf(false) }
    var failed by remember(questionId) { mutableStateOf(false) }

    val shown = hint
    if (shown != null) {
        Text(
            "💡 $shown",
            style = MaterialTheme.typography.bodyLarge,
            color = Color(0xFF0C4A6E),
            modifier = Modifier.fillMaxWidth().background(Color(0xFFE0F2FE), RoundedCornerShape(16.dp)).padding(14.dp),
        )
        return
    }
    Column {
        OutlinedButton(
            onClick = {
                val token = Store.token(context) ?: return@OutlinedButton
                loading = true
                failed = false
                scope.launch {
                    try {
                        hint = Api.hint(token, questionId)
                    } catch (_: Exception) {
                        failed = true
                    }
                    loading = false
                }
            },
            enabled = !loading,
        ) { Text(if (loading) "Thinking…" else "💡 Need a hint?") }
        if (failed) Text("No hint right now. Try again in a moment.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}
