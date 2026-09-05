package com.gymbro.resttimer

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RestTimerModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestTimer")

    Events(EVENT_STATE_CHANGE)

    OnCreate {
      // Sem `context` aqui (que lança se o React context ainda não existe): um throw no OnCreate
      // derrubaria a inicialização do módulo inteiro só por causa da criação dos canais, que o
      // `start()` refaz de qualquer jeito.
      appContext.reactContext?.applicationContext?.let(RestTimerNotifications::ensureChannels)
      // O controller notifica sem saber quem escuta; enquanto o JS está vivo, quem escuta é aqui.
      RestTimerEvents.listener = { state -> sendEvent(EVENT_STATE_CHANGE, state.toMap()) }
    }

    OnDestroy {
      RestTimerEvents.listener = null
    }

    Function("getState") {
      RestTimerController.getState(context).toMap()
    }

    /**
     * `true` (uma única vez) quando o app foi trazido de volta por um toque na notificação ou na
     * bolinha — a MainActivity é `singleTask` e o ReactActivity guarda o intent novo via
     * `setIntent()` no `onNewIntent`, então dá pra ler o extra aqui e abrir a tela do timer.
     */
    Function("consumeOpenTimerRequest") {
      val intent = appContext.currentActivity?.intent ?: return@Function false
      val requested = intent.getBooleanExtra(RestTimerController.EXTRA_OPEN_TIMER, false)
      if (requested) intent.removeExtra(RestTimerController.EXTRA_OPEN_TIMER)
      requested
    }

    Function("start") { totalSeconds: Double ->
      RestTimerController.start(context, (totalSeconds * 1000).toLong())
    }

    Function("pause") {
      RestTimerController.pause(context)
    }

    Function("resume") {
      RestTimerController.resume(context)
    }

    Function("reset") {
      RestTimerController.reset(context)
    }

    Function("stopAlarm") {
      RestTimerController.stopAlarm(context)
    }

    Function("addMinute") {
      RestTimerController.addMinute(context)
    }

    Function("setVibrationEnabled") { enabled: Boolean ->
      RestTimerController.setVibrationEnabled(context, enabled)
    }

    Function("setBubbleEnabled") { enabled: Boolean ->
      RestTimerController.setBubbleEnabled(context, enabled)
    }

    Function("canDrawOverlays") {
      RestTimerBubble.canDrawOverlays(context)
    }

    Function("openOverlaySettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
          .setData(Uri.fromParts("package", context.packageName, null))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    Function("canScheduleExactAlarms") {
      RestTimerController.canScheduleExactAlarms(context)
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
          .setData(Uri.fromParts("package", context.packageName, null))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    Function("openNotificationSettings") {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private companion object {
    const val EVENT_STATE_CHANGE = "onTimerStateChange"
  }
}
