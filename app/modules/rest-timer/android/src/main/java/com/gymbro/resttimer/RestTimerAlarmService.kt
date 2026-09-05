package com.gymbro.resttimer

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.ServiceCompat

/**
 * Foreground service curto, iniciado só quando o alarme dispara. Ele existe por um motivo único:
 * manter o processo vivo e com CPU (wake lock) durante a vibração — foi exatamente isso que
 * faltava na tentativa anterior, em que o `Vibration.vibrate()` do JS não acontecia com a tela
 * bloqueada porque o processo estava congelado.
 *
 * O `USAGE_ALARM` é a outra metade: é o que faz a vibração passar mesmo com o aparelho no
 * silencioso e com a tela bloqueada, em vez de ser tratada como notificação comum.
 */
class RestTimerAlarmService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null
  private val stopRunnable = Runnable { stopSelf() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    RestTimerNotifications.ensureChannels(this)
    startAsForeground()

    if (RestTimerStore.load(this).vibrationEnabled) {
      acquireWakeLock()
      startVibration()
    }

    // Um alarme ignorado não pode vibrar pra sempre — mesmo teto de 30s que a versão em JS tinha.
    handler.removeCallbacks(stopRunnable)
    handler.postDelayed(stopRunnable, MAX_ALARM_MS)

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(stopRunnable)
    stopVibration()
    releaseWakeLock()
    // DETACH: quando a vibração se esgota sozinha (30s), o aviso "Descanso concluído!" precisa
    // continuar na barra — igual a um alarme perdido. Sem isso o Android apaga a notificação junto
    // com o serviço e o usuário nunca vê que o descanso acabou.
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH)
    super.onDestroy()
  }

  private fun startAsForeground() {
    val notification = RestTimerNotifications.alarmNotification(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        RestTimerNotifications.NOTIFICATION_ALARM,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else {
      startForeground(RestTimerNotifications.NOTIFICATION_ALARM, notification)
    }
  }

  private fun vibrator(): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(VibratorManager::class.java))?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Vibrator::class.java)
    }

  private fun startVibration() {
    val vibrator = vibrator() ?: return
    if (!vibrator.hasVibrator()) return

    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
        vibrator.vibrate(
          VibrationEffect.createWaveform(VIBRATION_PATTERN, 0),
          VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM)
        )

      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
        @Suppress("DEPRECATION")
        vibrator.vibrate(VibrationEffect.createWaveform(VIBRATION_PATTERN, 0), attributes)

      else ->
        @Suppress("DEPRECATION")
        vibrator.vibrate(VIBRATION_PATTERN, 0, attributes)
    }
  }

  private fun stopVibration() {
    vibrator()?.cancel()
  }

  private fun acquireWakeLock() {
    val power = getSystemService(PowerManager::class.java) ?: return
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire(MAX_ALARM_MS)
    }
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private companion object {
    const val MAX_ALARM_MS = 30_000L
    const val WAKE_LOCK_TAG = "gymbro:rest-timer-alarm"

    // Mesmo padrão da versão em JS: pausa, 700ms de vibração, 400ms de silêncio, repetindo.
    val VIBRATION_PATTERN = longArrayOf(0, 700, 400)
  }
}
