package com.studyplan.kid

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File

private const val MAX_PAGES = 3

private class PaperWords(val title: String, val ai: String, val parent: String, val toParent: String, val takePhoto: String, val gallery: String, val which: String)

private fun paperWords(band: AgeBand) = when (band) {
    AgeBand.Little -> PaperWords(
        title = "📝 Did it on paper?",
        ai = "🤖 Check with the computer",
        parent = "👪 Check with a grown-up",
        toParent = "👪 Send to a grown-up",
        takePhoto = "📷 Take a picture",
        gallery = "🖼️ Gallery",
        which = "Which homework?",
    )
    AgeBand.Middle -> PaperWords(
        title = "📝 Did it on paper?",
        ai = "Check with AI",
        parent = "Check with parent",
        toParent = "Send to my parent",
        takePhoto = "📷 Take a photo",
        gallery = "Gallery",
        which = "Which homework?",
    )
    AgeBand.Teen -> PaperWords(
        title = "Homework on paper",
        ai = "Check with AI",
        parent = "Check with parent",
        toParent = "Send to parent",
        takePhoto = "Take a photo",
        gallery = "Gallery",
        which = "Homework",
    )
}

private fun newPhotoUri(context: Context): Uri {
    val dir = File(context.cacheDir, "paper").apply { mkdirs() }
    val file = File.createTempFile("page", ".jpg", dir)
    return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
}

/** Did the homework on paper? Photograph it (up to 3 pages), then choose who checks it: the AI (minutes at once) or a parent. */
@Composable
fun PaperCard(vm: StudyViewModel, sets: List<PaperSet>, aiCheckEnabled: Boolean) {
    val context = LocalContext.current
    val words = paperWords(vm.band)
    var selected by rememberSaveable { mutableIntStateOf(0) }
    var pages by rememberSaveable { mutableStateOf(listOf<String>()) } // photo addresses, kept across the camera app
    var pending by rememberSaveable { mutableStateOf<String?>(null) } // the photo the camera is writing

    val takePhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val uri = pending
        pending = null
        if (taken && uri != null && pages.size < MAX_PAGES) pages = pages + uri
    }
    val choosePhotos = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_PAGES)) { uris ->
        pages = (pages + uris.map(Uri::toString)).take(MAX_PAGES)
    }

    var open by rememberSaveable { mutableStateOf(false) }
    if (!open) {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth().height(60.dp)) {
            Text(words.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        return
    }

    val set = sets[selected.coerceIn(0, sets.lastIndex)]
    LookCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(words.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            TextButton(onClick = { open = false }) { Text("✕", style = MaterialTheme.typography.titleLarge) }
        }

        if (sets.size > 1) {
            Text(words.which, style = MaterialTheme.typography.labelLarge)
            sets.forEachIndexed { index, s ->
                if (s.id == set.id) Button(onClick = { selected = index }, modifier = Modifier.fillMaxWidth()) { Text(s.subject) }
                else OutlinedButton(onClick = { selected = index }, modifier = Modifier.fillMaxWidth()) { Text(s.subject) }
            }
        } else {
            Text(set.subject, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                enabled = pages.size < MAX_PAGES && !vm.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = {
                    val uri = newPhotoUri(context)
                    pending = uri.toString()
                    Store.allowCameraFor(context) // the camera is a blocked app; let it open for a few minutes
                    takePhoto.launch(uri)
                },
            ) { Text(words.takePhoto) }
            OutlinedButton(
                enabled = pages.size < MAX_PAGES && !vm.busy,
                modifier = Modifier.weight(1f).height(52.dp),
                onClick = {
                    Store.allowCameraFor(context)
                    choosePhotos.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
            ) { Text(words.gallery) }
        }

        if (pages.isNotEmpty()) {
            Text("${pages.size}/$MAX_PAGES 📷", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            val uris = pages.map(Uri::parse)
            if (aiCheckEnabled) {
                Button(enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(56.dp), onClick = { vm.sendPaper(set.id, uris, "ai") { pages = emptyList(); open = false } }) {
                    Text(if (vm.busy) "…" else words.ai, style = MaterialTheme.typography.titleMedium)
                }
                OutlinedButton(enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(52.dp), onClick = { vm.sendPaper(set.id, uris, "parent") { pages = emptyList(); open = false } }) {
                    Text(words.parent)
                }
            } else {
                Button(enabled = !vm.busy, modifier = Modifier.fillMaxWidth().height(56.dp), onClick = { vm.sendPaper(set.id, uris, "parent") { pages = emptyList(); open = false } }) {
                    Text(if (vm.busy) "…" else words.toParent, style = MaterialTheme.typography.titleMedium)
                }
            }
            OutlinedButton(enabled = !vm.busy, onClick = { pages = pages.dropLast(1) }) { Text("↩") }
        }
    }
}
