package com.studyplan.kid

import java.io.ByteArrayOutputStream

class FilePart(val field: String, val filename: String, val contentType: String, val bytes: ByteArray)

/** A multipart/form-data body. Free of Android classes so it can be unit tested. */
fun multipartBody(boundary: String, fields: Map<String, String>, files: List<FilePart>): ByteArray {
    val out = ByteArrayOutputStream()
    val nl = "\r\n"

    fun write(text: String) = out.write(text.toByteArray(Charsets.UTF_8))

    for ((name, value) in fields) {
        write("--$boundary$nl")
        write("Content-Disposition: form-data; name=\"$name\"$nl$nl")
        write(value)
        write(nl)
    }
    for (file in files) {
        write("--$boundary$nl")
        write("Content-Disposition: form-data; name=\"${file.field}\"; filename=\"${file.filename}\"$nl")
        write("Content-Type: ${file.contentType}$nl$nl")
        out.write(file.bytes)
        write(nl)
    }
    write("--$boundary--$nl")
    return out.toByteArray()
}
