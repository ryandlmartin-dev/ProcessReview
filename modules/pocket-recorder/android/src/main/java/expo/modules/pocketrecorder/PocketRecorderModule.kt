package expo.modules.pocketrecorder

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PocketRecorderModule : Module() {
  private fun stripScheme(path: String) = path.removePrefix("file://")

  override fun definition() = ModuleDefinition {
    Name("PocketRecorder")

    Events("onSegment", "onLevel", "onStopped", "onError")

    OnCreate {
      RecorderEngine.listener = { name, body ->
        if (name == "onStopped") stopService()
        sendEvent(name, body)
      }
    }

    OnDestroy {
      RecorderEngine.listener = null
    }

    AsyncFunction("start") { fullPath: String, segmentDir: String, segmentSeconds: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      RecorderEngine.start(stripScheme(fullPath), stripScheme(segmentDir), segmentSeconds)
      val intent = Intent(context, RecordingService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      Unit
    }

    AsyncFunction("stop") {
      RecorderEngine.stop()
      stopService()
    }

    Function("pause") {
      RecorderEngine.isPaused = true
      Unit
    }

    Function("resume") {
      RecorderEngine.isPaused = false
      Unit
    }

    Function("getStatus") {
      mapOf(
        "isRecording" to RecorderEngine.isRecording,
        "isPaused" to RecorderEngine.isPaused,
        "elapsedMs" to RecorderEngine.elapsedMs.toDouble()
      )
    }
  }

  private fun stopService() {
    val context = appContext.reactContext ?: return
    context.stopService(Intent(context, RecordingService::class.java))
  }
}
