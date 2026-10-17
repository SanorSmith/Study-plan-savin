package com.studyplan.parent

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

private val Brand = Color(0xFF6C4CF1)

/** The parent app is always light, friendly and violet, like the website. */
@Composable
private fun ParentTheme(content: @Composable () -> Unit) {
    val scheme = lightColorScheme(
        primary = Brand, onPrimary = Color.White,
        primaryContainer = Color(0xFFEDE9FE), onPrimaryContainer = Color(0xFF3B1FA8),
        secondaryContainer = Color(0xFFEDE9FE), onSecondaryContainer = Color(0xFF3B1FA8),
        background = Color(0xFFF5F6FF), surface = Color.White, onSurface = Color(0xFF0F172A),
        surfaceVariant = Color(0xFFF1F0FF), onSurfaceVariant = Color(0xFF475569),
        surfaceContainerHighest = Color.White, surfaceContainerHigh = Color.White, surfaceContainer = Color.White, surfaceContainerLow = Color.White, surfaceContainerLowest = Color.White,
        outline = Color(0xFFCBD5E1), outlineVariant = Color(0xFFE2E8F0), error = Color(0xFFE11D48),
    )
    val shapes = androidx.compose.material3.Shapes(
        small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
        medium = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        large = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
        extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(28.dp),
    )
    MaterialTheme(colorScheme = scheme, shapes = shapes, content = content)
}

class MainActivity : ComponentActivity() {
    private val vm: ParentViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ParentTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Root(vm)
                }
            }
        }
    }
}

@Composable
private fun Root(vm: ParentViewModel) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val askNotifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}

    val signedIn = vm.token != null
    LaunchedEffect(signedIn) {
        if (signedIn) {
            Notifier.schedule(context)
            AlertService.start(context)
            if (Build.VERSION.SDK_INT >= 33 && !Notifier.allowed(context)) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    // Coming back to the app (also from a notification) shows what is waiting now.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { if (vm.token != null) vm.refresh() }

    if (!signedIn) {
        PairScreen(vm)
        return
    }
    BackHandler(enabled = vm.screen != Screen.Home) { vm.back() }
    Box(Modifier.fillMaxSize()) {
        when (val s = vm.screen) {
            Screen.Home -> HomeScreen(vm)
            is Screen.Kid -> KidScreen(vm, s.id)
            is Screen.Paper -> PaperScreen(vm, s.id)
            Screen.AddKid -> KidFormScreen(vm, null)
            is Screen.EditKid -> KidFormScreen(vm, s.id)
            is Screen.Results -> ResultsScreen(vm, s.id)
            is Screen.NewHomework -> NewHomeworkScreen(vm, s.id)
            is Screen.EditHomework -> EditHomeworkScreen(vm, s.id, s.setId)
            is Screen.Performance -> PerformanceScreen(vm, s.id)
            is Screen.Practice -> PracticeScreen(vm, s.id)
        }
    }
}
