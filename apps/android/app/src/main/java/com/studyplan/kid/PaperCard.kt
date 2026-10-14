package com.studyplan.kid

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File

private const val MAX_PAGES = 3

private fun newPhotoUri(context: Context): Uri {
    val dir = File(context.cacheDir, "paper").apply { mkdirs() }
    val file = File.createTempFile("page", ".jpg", dir)
    return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
}

/** Did the homework on paper? Photograph it (up to 3 pages). A parent checks it and the minutes arrive after. */
@Composable
fun PaperCard(vm: StudyViewModel, sets: List<PaperSet>) {
    val context = LocalContext.current
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

    val set = sets[selected.coerceIn(0, sets.lastIndex)]
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Did it on paper?", fontSize = 20.sp)
            Text("Take a photo of your finished paper. A parent checks it, and your minutes arrive after.", fontSize = 14.sp)

            if (sets.size > 1) {
                Text("Which homework?", fontSize = 14.sp)
                sets.forEachIndexed { index, s ->
                    if (s.id == set.id) Button(onClick = { selected = index }, modifier = Modifier.fillMaxWidth()) { Text(s.subject) }
                    else OutlinedButton(onClick = { selected = index }, modifier = Modifier.fillMaxWidth()) { Text(s.subject) }
                }
            } else {
                Text(set.subject, fontSize = 14.sp)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    enabled = pages.size < MAX_PAGES && !vm.busy,
                    onClick = {
                        val uri = newPhotoUri(context)
                        pending = uri.toString()
                        Store.allowCameraFor(context) // the camera is a blocked app; let it open for a few minutes
                        takePhoto.launch(uri)
                    },
                ) { Text("Take a photo") }
                OutlinedButton(
                    enabled = pages.size < MAX_PAGES && !vm.busy,
                    onClick = {
                        Store.allowCameraFor(context)
                        choosePhotos.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                ) { Text("From gallery") }
            }

            if (pages.isNotEmpty()) {
                Text("${pages.size} of $MAX_PAGES photos ready", fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        enabled = !vm.busy,
                        onClick = { vm.sendPaper(set.id, pages.map(Uri::parse)) { pages = emptyList() } },
                    ) { Text(if (vm.busy) "Sending…" else "Send my paper") }
                    OutlinedButton(enabled = !vm.busy, onClick = { pages = pages.dropLast(1) }) { Text("Remove last") }
                }
            }
        }
    }
}
