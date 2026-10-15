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
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

private val Teal = Color(0xFF0F766E)

@Composable
private fun ParentTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) {
        darkColorScheme(primary = Color(0xFF5EEAD4), onPrimary = Color(0xFF042F2E), background = Color(0xFF0B1210), surface = Color(0xFF0B1210))
    } else {
        lightColorScheme(primary = Teal, onPrimary = Color.White, background = Color(0xFFF6FAF9), surface = Color(0xFFF6FAF9))
    }
    MaterialTheme(colorScheme = scheme, content = content)
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
            if (Build.VERSION.SDK_INT >= 33 && !Notifier.allowed(context)) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    // Coming back to the app (also from a notification) shows what is waiting now.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { if (vm.token != null) vm.refresh() }

    if (!signedIn) {
        PairScreen(vm)
        return
    }
    BackHandler(enabled = vm.screen != Screen.Home) {
        vm.clearMessages()
        vm.screen = Screen.Home
    }
    Box(Modifier.fillMaxSize()) {
        when (val s = vm.screen) {
            Screen.Home -> HomeScreen(vm)
            is Screen.Kid -> KidScreen(vm, s.id)
            is Screen.Paper -> PaperScreen(vm, s.id)
        }
    }
}
