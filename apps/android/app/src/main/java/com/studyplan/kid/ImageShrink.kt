package com.studyplan.kid

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.ByteArrayOutputStream

/**
 * Shrinks a phone photo before it is uploaded. Camera photos are often 5 to 12 MB and the server takes about
 * 4.5 MB per upload, so each page is scaled to 2000 px on the long side, which keeps handwriting readable.
 */
object ImageShrink {
    const val MAX_SIDE = 2000

    /** The size after scaling the long side down to [maxSide]; smaller photos are left alone. */
    fun scaledSize(width: Int, height: Int, maxSide: Int = MAX_SIDE): Pair<Int, Int> {
        val longSide = maxOf(width, height)
        if (longSide <= maxSide) return width to height
        val scale = maxSide.toDouble() / longSide
        return maxOf(1, Math.round(width * scale).toInt()) to maxOf(1, Math.round(height * scale).toInt())
    }

    /** A power-of-two decode factor that keeps the decoded photo at least [maxSide] px on the long side. */
    fun sampleSize(width: Int, height: Int, maxSide: Int = MAX_SIDE): Int {
        var sample = 1
        while (maxOf(width, height) / (sample * 2) >= maxSide) sample *= 2
        return sample
    }

    /** Reads the photo, applies the camera's rotation, scales it and returns JPEG bytes. */
    fun toJpeg(context: Context, uri: Uri, quality: Int = 82): ByteArray {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Could not read the photo" }

        val options = BitmapFactory.Options().apply { inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight) }
        var bitmap = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
            ?: error("Could not read the photo")

        val (width, height) = scaledSize(bitmap.width, bitmap.height)
        if (width != bitmap.width || height != bitmap.height) bitmap = Bitmap.createScaledBitmap(bitmap, width, height, true)

        val degrees = resolver.openInputStream(uri)?.use { rotationDegrees(ExifInterface(it)) } ?: 0
        if (degrees != 0) {
            bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees.toFloat()) }, true)
        }

        return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it) }.toByteArray()
    }

    private fun rotationDegrees(exif: ExifInterface): Int =
        when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }
}
