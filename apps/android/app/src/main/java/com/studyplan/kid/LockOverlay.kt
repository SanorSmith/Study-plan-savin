package com.studyplan.kid

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A full-screen cover drawn over a blocked app ("Display over other apps"). It has one button that opens
 * Study Plan, where the kid does homework or a parent types their PIN. Plain views, so it needs no activity.
 */
class LockOverlay(private val context: Context) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var view: View? = null
    private var shown: String? = null

    fun show(reason: LockReason, untilMinute: Int?) {
        val key = "$reason/$untilMinute"
        if (view != null && shown == key) return
        hide()

        val (title, body, button) = when (reason) {
            LockReason.Protected -> Triple("Parents only", "Settings and uninstalling need a parent.", "Enter parent PIN")
            LockReason.Scheduled -> Triple(
                "Phone is off",
                if (untilMinute != null) "Locked until ${formatMinute(untilMinute)}." else "Locked for now.",
                "Open Study Plan",
            )
            LockReason.NoCredit -> Triple("Homework first", "Answer homework questions to earn screen time.", "Open Study Plan")
        }

        val dp = context.resources.displayMetrics.density
        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#FFFBFE"))
            setPadding((32 * dp).toInt(), (32 * dp).toInt(), (32 * dp).toInt(), (32 * dp).toInt())
            isFocusableInTouchMode = true
            // Back must not reveal the blocked app underneath.
            setOnKeyListener { _, keyCode, _ -> keyCode == KeyEvent.KEYCODE_BACK }
        }
        content.addView(
            TextView(context).apply {
                text = title
                textSize = 32f
                setTextColor(Color.parseColor("#1C1B1F"))
                gravity = Gravity.CENTER
            },
        )
        content.addView(
            TextView(context).apply {
                text = body
                textSize = 18f
                setTextColor(Color.parseColor("#49454F"))
                gravity = Gravity.CENTER
                setPadding(0, (12 * dp).toInt(), 0, (24 * dp).toInt())
            },
        )
        content.addView(
            Button(context).apply {
                text = button
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
