package com.studyplan.kid

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A full-screen cover drawn over a blocked app ("Display over other apps"). It has one button that opens
 * Study Plan, where the kid does homework or a parent types the PIN. Plain views, so it needs no activity.
 * Its colors and words follow the kid's age band.
 */
class LockOverlay(private val context: Context) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var view: View? = null
    private var shown: String? = null

    private class Palette(val background: Int, val title: Int, val body: Int, val button: Int, val buttonText: Int, val titleSize: Float, val bodySize: Float)

    private fun palette(band: AgeBand): Palette {
        val night = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        return when (band) {
            AgeBand.Little -> Palette(Color.parseColor("#FFF3D6"), Color.parseColor("#6C4CF1"), Color.parseColor("#1F1B3A"), Color.parseColor("#6C4CF1"), Color.WHITE, 40f, 22f)
            AgeBand.Middle -> Palette(Color.parseColor("#EEF2FF"), Color.parseColor("#4F46E5"), Color.parseColor("#0F172A"), Color.parseColor("#4F46E5"), Color.WHITE, 34f, 19f)
            AgeBand.Teen ->
                if (night) Palette(Color.parseColor("#020617"), Color.parseColor("#F1F5F9"), Color.parseColor("#CBD5E1"), Color.parseColor("#F1F5F9"), Color.parseColor("#0F172A"), 28f, 17f)
                else Palette(Color.parseColor("#F8FAFC"), Color.parseColor("#0F172A"), Color.parseColor("#475569"), Color.parseColor("#0F172A"), Color.WHITE, 28f, 17f)
        }
    }

    fun show(reason: LockReason, untilMinute: Int?) {
        val band = Store.band(context)
        val key = "$reason/$untilMinute/$band"
        if (view != null && shown == key) return
        hide()

        val text = lockText(band, reason, untilMinute)
        val colors = palette(band)
        val dp = context.resources.displayMetrics.density

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(colors.background)
            setPadding((32 * dp).toInt(), (32 * dp).toInt(), (32 * dp).toInt(), (32 * dp).toInt())
            isFocusableInTouchMode = true
            // Back must not reveal the blocked app underneath.
            setOnKeyListener { _, keyCode, _ -> keyCode == KeyEvent.KEYCODE_BACK }
        }
        content.addView(
            TextView(context).apply {
                this.text = text.title
                textSize = colors.titleSize
                setTextColor(colors.title)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                gravity = Gravity.CENTER
            },
        )
        content.addView(
            TextView(context).apply {
                this.text = text.body
                textSize = colors.bodySize
                setTextColor(colors.body)
                gravity = Gravity.CENTER
                setPadding(0, (14 * dp).toInt(), 0, (28 * dp).toInt())
            },
        )
        content.addView(
            Button(context).apply {
                this.text = text.button
                isAllCaps = false
                textSize = colors.bodySize
                setTextColor(colors.buttonText)
                setPadding((32 * dp).toInt(), (14 * dp).toInt(), (32 * dp).toInt(), (14 * dp).toInt())
                background = GradientDrawable().apply {
                    setColor(colors.button)
                    cornerRadius = (if (band == AgeBand.Teen) 12 else 28) * dp
                }
                setOnClickListener {
                    context.startActivity(
                        Intent(context, LockActivity::class.java)
                            .putExtra(LockActivity.EXTRA_REASON, reason.name)
                            .putExtra(LockActivity.EXTRA_UNTIL, untilMinute ?: -1)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                    )
                }
            },
        )

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.OPAQUE,
        )
        runCatching {
            windowManager.addView(content, params)
            view = content
            shown = key
            content.requestFocus()
        }
    }

    fun hide() {
        view?.let { runCatching { windowManager.removeView(it) } }
        view = null
        shown = null
    }
}
