package com.gymbro.resttimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Locale

object RestTimerNotifications {
  // Sufixo de versão no id do canal: as configurações de um canal ficam congeladas depois da
  // primeira criação (o Android ignora mudanças), então mexer em importância/vibração exige um id
  // novo, senão a mudança só vale pra quem instalar o app do zero.
  const val CHANNEL_RUNNING = "rest_timer_running_v1"
  const val CHANNEL_ALARM = "rest_timer_alarm_v1"

  const val NOTIFICATION_RUNNING = 4711
  const val NOTIFICATION_ALARM = 4712

  const val BRAND_COLOR = 0xFF15B580.toInt()

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return

    val running = NotificationChannel(
      CHANNEL_RUNNING,
      "Timer em andamento",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Mostra a contagem regressiva do descanso enquanto ela corre."
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
    }

    // IMPORTANCE_HIGH pra aparecer na tela de bloqueio e como heads-up. A vibração do canal fica
    // desligada de propósito: quem vibra é o RestTimerAlarmService, com padrão repetido e parada
    // controlada — o canal só sabe vibrar uma vez e não sabe parar quando o usuário toca "Parar".
    val alarm = NotificationChannel(
      CHANNEL_ALARM,
      "Alarme do timer",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Avisa quando o descanso termina."
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }

    manager.createNotificationChannel(running)
    manager.createNotificationChannel(alarm)
  }

  /** Traz o app de volta no estado em que estava (MainActivity é `singleTask`), sem recriá-lo. */
  fun openAppIntent(context: Context): PendingIntent? {
    val launch = openAppRawIntent(context) ?: return null
    return PendingIntent.getActivity(
      context,
      REQUEST_OPEN_APP,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Mesma intent, sem PendingIntent — a bolinha flutuante abre o app direto com `startActivity`. */
  fun openAppRawIntent(context: Context): Intent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    launch.putExtra(RestTimerController.EXTRA_OPEN_TIMER, true)
    return launch
  }

  private fun actionIntent(context: Context, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(context, RestTimerActionReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun baseBuilder(context: Context, channelId: String): NotificationCompat.Builder =
    NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_rest_timer)
      .setColor(BRAND_COLOR)
      .setContentIntent(openAppIntent(context))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOnlyAlertOnce(true)

  /**
   * Notificação de contagem: quem conta os segundos é o próprio Android
   * (`usesChronometer` + `chronometerCountDown` + `when` no futuro), não o app — é por isso que ela
   * continua correta mesmo com o processo do app morto, sem nenhum update por segundo.
   */
  fun runningNotification(context: Context, endsAt: Long): Notification =
    baseBuilder(context, CHANNEL_RUNNING)
      .setContentTitle("Descanso em andamento")
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(true)
      .setWhen(endsAt)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .addAction(0, "Pausar", actionIntent(context, RestTimerController.ACTION_PAUSE, REQUEST_PAUSE))
      .addAction(0, "Zerar", actionIntent(context, RestTimerController.ACTION_RESET, REQUEST_RESET))
      .build()

  fun pausedNotification(context: Context, remainingMs: Long): Notification =
    baseBuilder(context, CHANNEL_RUNNING)
      .setContentTitle("Descanso pausado")
      .setContentText(formatRemaining(remainingMs) + " restantes")
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .addAction(0, "Retomar", actionIntent(context, RestTimerController.ACTION_RESUME, REQUEST_RESUME))
      .addAction(0, "Zerar", actionIntent(context, RestTimerController.ACTION_RESET, REQUEST_RESET))
      .build()

  /** A notificação que corresponde ao estado atual — usada pelo serviço da bolinha, que precisa
   * adotar a mesma notificação de contagem em vez de criar uma segunda. */
  fun forState(context: Context, state: RestTimerState): Notification =
    if (state.status == RestTimerStatus.PAUSED) pausedNotification(context, state.remainingMs)
    else runningNotification(context, state.endsAt)

  fun alarmNotification(context: Context): Notification =
    baseBuilder(context, CHANNEL_ALARM)
      .setContentTitle("Descanso concluído!")
      .setContentText("Hora da próxima série.")
      .setOngoing(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .addAction(0, "Parar", actionIntent(context, RestTimerController.ACTION_STOP_ALARM, REQUEST_STOP_ALARM))
      .addAction(0, "+1 min", actionIntent(context, RestTimerController.ACTION_ADD_MINUTE, REQUEST_ADD_MINUTE))
      .build()

  fun notify(context: Context, id: Int, notification: Notification) {
    // areNotificationsEnabled() cobre o Android 13+ sem POST_NOTIFICATIONS: sem isso o notify()
    // lança SecurityException dentro do receiver e derruba a ação inteira (pausar/zerar).
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return
    try {
      manager.notify(id, notification)
    } catch (_: SecurityException) {
      // Permissão revogada entre o check e o notify — nada a fazer além de não quebrar a ação.
    }
  }

  fun cancel(context: Context, id: Int) {
    NotificationManagerCompat.from(context).cancel(id)
  }

  fun formatRemaining(remainingMs: Long): String {
    val totalSeconds = (remainingMs.coerceAtLeast(0L) + 999L) / 1000L
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format(Locale.US, "%02d:%02d", minutes, seconds)
  }

  private const val REQUEST_OPEN_APP = 100
  private const val REQUEST_PAUSE = 101
  private const val REQUEST_RESUME = 102
  private const val REQUEST_RESET = 103
  private const val REQUEST_STOP_ALARM = 104
  private const val REQUEST_ADD_MINUTE = 105
}
