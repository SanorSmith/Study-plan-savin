package com.studyplan.kid

import android.content.Context
import android.net.Uri

/** One file of a paper, ready to upload: a shrunk photo or a PDF as it is. */
class UploadFile(val bytes: ByteArray, val contentType: String, val name: String)

/** Photos and PDFs of a finished paper. The server takes about 4.5 MB per upload, so the total is kept under 4 MB. */
object PaperFiles {
    const val MAX_TOTAL_BYTES = 4_000_000

    fun isPdf(mime: String?): Boolean = mime == "application/pdf"

    /** True when the files together are too big for the server. */
    fun tooLarge(sizes: List<Int>): Boolean = sizes.sum() > MAX_TOTAL_BYTES

    fun fileName(index: Int, mime: String): String = if (isPdf(mime)) "paper${index + 1}.pdf" else "page${index + 1}.jpg"

    /** Reads one picked file: a PDF is sent untouched, a photo is turned and shrunk first. */
    fun read(context: Context, uri: Uri, index: Int): UploadFile {
        val mime = context.contentResolver.getType(uri)
        if (isPdf(mime)) {
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: error("Could not read the PDF")
            return UploadFile(bytes, "application/pdf", fileName(index, "application/pdf"))
        }
        return UploadFile(ImageShrink.toJpeg(context, uri), "image/jpeg", fileName(index, "image/jpeg"))
    }
}
