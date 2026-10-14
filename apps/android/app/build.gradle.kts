import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Dev-only settings live in local.properties (never committed):
//   api.baseUrl=https://<your deployment>
//   api.bypass=<Vercel automation bypass secret, only needed while Deployment Protection is on>
val local = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

android {
    namespace = "com.studyplan.kid"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.studyplan.kid"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.5.0"
        buildConfigField("String", "API_BASE_URL", "\"${local.getProperty("api.baseUrl", "https://study-plan-savin.vercel.app")}\"")
        buildConfigField("String", "API_BYPASS", "\"${local.getProperty("api.bypass", "")}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.06.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    testImplementation("junit:junit:4.13.2")
}
