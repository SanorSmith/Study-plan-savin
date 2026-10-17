package com.studyplan.parent

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File

/** Turns the first pages of a PDF into pictures so they can be shown like photos. */
object PdfPages {
    const val MAX_PAGES = 5

    /** The size to draw a page at: [width] pixels wide, keeping the page's shape. */
    fun pageSize(pageWidth: Int, pageHeight: Int, width: Int = 1500): Pair<Int, Int> {
        if (pageWidth <= 0 || pageHeight <= 0) return width to width
        return width to maxOf(1, Math.round(width.toDouble() * pageHeight / pageWidth).toInt())
    }

    fun render(context: Context, bytes: ByteArray): List<Bitmap> {
        val file = File.createTempFile("paper", ".pdf", context.cacheDir)
        try {
            file.writeBytes(bytes)
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
                PdfRenderer(fd).use { renderer ->
                    return (0 until minOf(renderer.pageCount, MAX_PAGES)).map { i ->
                        renderer.openPage(i).use { page ->
                            val (w, h) = pageSize(page.width, page.height)
                            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                            bmp.eraseColor(Color.WHITE)
                            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            bmp
                        }
                    }
                }
            }
        } finally {
            file.delete()
        }
    }
}
