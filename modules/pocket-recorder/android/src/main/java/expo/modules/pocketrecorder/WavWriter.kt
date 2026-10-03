package expo.modules.pocketrecorder

import java.io.File
import java.io.RandomAccessFile

/**
 * Streams 16-bit PCM mono audio into a WAV file. The header is written with
 * placeholder sizes up front and patched on close(), so the file is only a
 * valid WAV once closed.
 */
class WavWriter(val file: File, private val sampleRate: Int) {
  private val raf: RandomAccessFile
  var dataBytes: Long = 0
    private set

  init {
    file.parentFile?.mkdirs()
    raf = RandomAccessFile(file, "rw")
    raf.setLength(0)
    raf.write(header(0))
  }

  fun write(buffer: ByteArray, length: Int) {
    raf.write(buffer, 0, length)
    dataBytes += length
  }

  fun close() {
    raf.seek(0)
    raf.write(header(dataBytes))
    raf.close()
  }

  private fun header(dataLength: Long): ByteArray {
    val channels = 1
    val bitsPerSample = 16
    val byteRate = sampleRate * channels * bitsPerSample / 8
    val totalLength = dataLength + 36
    val h = ByteArray(44)
    fun putInt(offset: Int, value: Long) {
      h[offset] = (value and 0xff).toByte()
      h[offset + 1] = ((value shr 8) and 0xff).toByte()
      h[offset + 2] = ((value shr 16) and 0xff).toByte()
      h[offset + 3] = ((value shr 24) and 0xff).toByte()
    }
    fun putShort(offset: Int, value: Int) {
      h[offset] = (value and 0xff).toByte()
      h[offset + 1] = ((value shr 8) and 0xff).toByte()
    }
    "RIFF".toByteArray().copyInto(h, 0)
    putInt(4, totalLength)
    "WAVE".toByteArray().copyInto(h, 8)
    "fmt ".toByteArray().copyInto(h, 12)
    putInt(16, 16)
    putShort(20, 1) // PCM
    putShort(22, channels)
    putInt(24, sampleRate.toLong())
    putInt(28, byteRate.toLong())
    putShort(32, channels * bitsPerSample / 8)
    putShort(34, bitsPerSample)
    "data".toByteArray().copyInto(h, 36)
    putInt(40, dataLength)
    return h
  }
}
