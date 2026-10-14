package com.studyplan.kid

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaperUploadTest {
    @Test
    fun smallPhotosAreNotScaled() {
        assertEquals(1600 to 1200, ImageShrink.scaledSize(1600, 1200))
    }

    @Test
    fun largePhotosKeepTheirShapeAndFitTheLongSide() {
        assertEquals(2000 to 1500, ImageShrink.scaledSize(4000, 3000)) // landscape
        assertEquals(1500 to 2000, ImageShrink.scaledSize(3000, 4000)) // portrait
        assertEquals(2000 to 1125, ImageShrink.scaledSize(4096, 2304))
    }

    @Test
    fun decodeFactorKeepsEnoughDetailForHandwriting() {
        assertEquals(1, ImageShrink.sampleSize(1600, 1200))
        assertEquals(1, ImageShrink.sampleSize(2999, 3999)) // halving would leave 1999 px, below the target
        assertEquals(2, ImageShrink.sampleSize(3000, 4000)) // halving leaves exactly 2000 px
        assertEquals(2, ImageShrink.sampleSize(4000, 3000))
        assertEquals(4, ImageShrink.sampleSize(8000, 6000))
    }

    @Test
    fun multipartBodyHasTheFieldAndEveryPhoto() {
        val body = multipartBody(
            boundary = "XYZ",
            fields = mapOf("setId" to "abc"),
            files = listOf(
                FilePart("image", "page1.jpg", "image/jpeg", byteArrayOf(1, 2, 3)),
                FilePart("image", "page2.jpg", "image/jpeg", byteArrayOf(4, 5)),
            ),
        )
        val text = String(body, Charsets.ISO_8859_1)
        assertTrue(text.startsWith("--XYZ\r\nContent-Disposition: form-data; name=\"setId\"\r\n\r\nabc\r\n"))
        assertTrue(text.contains("name=\"image\"; filename=\"page1.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n"))
        assertTrue(text.contains("name=\"image\"; filename=\"page2.jpg\""))
        assertTrue(text.endsWith("--XYZ--\r\n"))
        // the raw bytes of the first photo are in the body unchanged
        assertTrue(body.toList().windowed(3).any { it == listOf<Byte>(1, 2, 3) })
    }
}
