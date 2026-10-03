package expo.modules.pocketrecorder

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.File
import kotlin.math.sqrt

/**
 * Captures 16 kHz mono PCM from the microphone on a background thread.
 *
 * Audio goes to two places at once:
 *  - one WAV file for the whole recording (kept as the note's audio), and
 *  - rolling WAV segments of `segmentSeconds`, each announced via `onSegment`
 *    so JS can transcribe while recording is still in progress.
 *
 * Lives as a process-wide singleton so the foreground service and the Expo
 * module share one recorder.
 */
object RecorderEngine {
  const val SAMPLE_RATE = 16000
  private const val BYTES_PER_SECOND = SAMPLE_RATE * 2

  @Volatile var isRecording = false
    private set
  @Volatile var isPaused = false
  @Volatile private var recordedBytes: Long = 0

  var listener: ((String, Map<String, Any?>) -> Unit)? = null
  private var thread: Thread? = null

  val elapsedMs: Long
    get() = recordedBytes * 1000 / BYTES_PER_SECOND

  private fun emit(name: String, body: Map<String, Any?>) {
    try {
      listener?.invoke(name, body)
    } catch (_: Throwable) {
      // JS side may be gone; recording must keep going regardless.
    }
  }

  @SuppressLint("MissingPermission")
  @Synchronized
  fun start(fullPath: String, segmentDir: String, segmentSeconds: Int) {
    if (isRecording) throw IllegalStateException("A recording is already in progress")

    val minBuffer = AudioRecord.getMinBufferSize(
      SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
    )
    if (minBuffer <= 0) throw IllegalStateException("Microphone does not support 16 kHz capture")
    val readSize = maxOf(minBuffer, BYTES_PER_SECOND / 5) // ~200 ms reads

    val recorder = AudioRecord(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT,
      readSize * 4
    )
    if (recorder.state != AudioRecord.STATE_INITIALIZED) {
      recorder.release()
      throw IllegalStateException("Microphone is unavailable (is another app using it?)")
    }

    val segmentLimit = segmentSeconds.coerceAtLeast(5).toLong() * BYTES_PER_SECOND
    File(segmentDir).mkdirs()
    recordedBytes = 0
    isPaused = false
    isRecording = true

    thread = Thread({
      val full = WavWriter(File(fullPath), SAMPLE_RATE)
      var segment: WavWriter? = null
      var segmentIndex = 0
      var segmentStartMs = 0L
      var lastLevelAt = 0L
      val buffer = ByteArray(readSize)
      var failure: String? = null

      fun closeSegment(isLast: Boolean) {
        val seg = segment
        segment = null
        if (seg == null) {
          if (isLast) emit("onSegment", mapOf("path" to null, "index" to segmentIndex, "startMs" to segmentStartMs.toDouble(), "isLast" to true))
          return
        }
        seg.close()
        emit(
          "onSegment",
          mapOf(
            "path" to "file://" + seg.file.absolutePath,
            "index" to segmentIndex,
            "startMs" to segmentStartMs.toDouble(),
            "durationMs" to (seg.dataBytes * 1000 / BYTES_PER_SECOND).toDouble(),
            "isLast" to isLast
          )
        )
        segmentIndex++
      }

      try {
        recorder.startRecording()
        while (isRecording) {
          val n = recorder.read(buffer, 0, buffer.size)
          if (n <= 0) continue
          if (isPaused) continue

          full.write(buffer, n)
          if (segment == null) {
            segmentStartMs = elapsedMs
            segment = WavWriter(File(segmentDir, "seg_$segmentIndex.wav"), SAMPLE_RATE)
          }
          segment!!.write(buffer, n)
          recordedBytes += n

          val now = System.currentTimeMillis()
          if (now - lastLevelAt > 120) {
            lastLevelAt = now
            emit("onLevel", mapOf("level" to rms(buffer, n), "elapsedMs" to elapsedMs.toDouble()))
          }
          if (segment!!.dataBytes >= segmentLimit) closeSegment(isLast = false)
        }
      } catch (e: Throwable) {
        failure = e.message ?: e.toString()
      } finally {
        try { recorder.stop() } catch (_: Throwable) {}
        recorder.release()
        try { full.close() } catch (_: Throwable) {}
        try { closeSegment(isLast = true) } catch (_: Throwable) {}
        isRecording = false
        isPaused = false
        failure?.let { emit("onError", mapOf("message" to it)) }
        emit(
          "onStopped",
          mapOf("path" to "file://$fullPath", "durationMs" to elapsedMs.toDouble())
        )
      }
    }, "PocketRecorder")
    thread!!.start()
  }

  fun stop() {
    isRecording = false
    val t = thread
    thread = null
    if (t != null && t != Thread.currentThread()) {
      try { t.join(3000) } catch (_: InterruptedException) {}
    }
  }

  /** Normalised 0..1 loudness for the level meter. */
  private fun rms(buffer: ByteArray, length: Int): Double {
    var sum = 0.0
    var count = 0
    var i = 0
    while (i + 1 < length) {
      val sample = ((buffer[i + 1].toInt() shl 8) or (buffer[i].toInt() and 0xff)).toShort().toDouble()
      sum += sample * sample
      count++
      i += 2
    }
    if (count == 0) return 0.0
    return (sqrt(sum / count) / 8000.0).coerceIn(0.0, 1.0)
  }
}
