package com.gymbro.resttimer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Toda a lógica do timer vive aqui, em Kotlin, e não no JS — é o que faz os botões da notificação
 * continuarem funcionando com o app fechado (o BroadcastReceiver chama estes métodos direto,
 * mesmo num processo recém-criado só pra entregar o broadcast).
 *
 * Duas peças fazem o trabalho pesado, nenhuma delas depende do processo continuar vivo:
 * - a notificação de contagem, cujo cronômetro é desenhado pelo próprio Android;
 * - um `AlarmManager.setAlarmClock()` no instante do 00:00, que acorda o aparelho até em Doze.
 */
object RestTimerController {
  const val ACTION_PAUSE = "com.gymbro.resttimer.PAUSE"
  const val ACTION_RESUME = "com.gymbro.resttimer.RESUME"
  const val ACTION_RESET = "com.gymbro.resttimer.RESET"
  const val ACTION_STOP_ALARM = "com.gymbro.resttimer.STOP_ALARM"
  const val ACTION_ADD_MINUTE = "com.gymbro.resttimer.ADD_MINUTE"
  const val ACTION_FIRE = "com.gymbro.resttimer.FIRE"

  const val EXTRA_OPEN_TIMER = "restTimerOpenTimer"

  const val SNOOZE_MS = 60_000L

  private const val REQUEST_ALARM = 200

  fun getState(context: Context): RestTimerState = RestTimerStore.load(context)

  fun start(context: Context, totalMs: Long) {
    if (totalMs <= 0L) return
    stopAlarmService(context)
    val endsAt = System.currentTimeMillis() + totalMs
    val state = getState(context).copy(
      status = RestTimerStatus.RUNNING,
      endsAt = endsAt,
      remainingMs = totalMs,
      totalMs = totalMs
    )
    scheduleAlarm(context, endsAt)
    RestTimerNotifications.ensureChannels(context)
    RestTimerNotifications.cancel(context, RestTimerNotifications.NOTIFICATION_ALARM)
    RestTimerNotifications.notify(
      context,
      RestTimerNotifications.NOTIFICATION_RUNNING,
      RestTimerNotifications.runningNotification(context, endsAt)
    )
    commit(context, state)
  }

  fun pause(context: Context) {
    val current = getState(context)
    if (current.status != RestTimerStatus.RUNNING) return
    val remaining = (current.endsAt - System.currentTimeMillis()).coerceAtLeast(0L)
    cancelAlarm(context)
    val state = current.copy(status = RestTimerStatus.PAUSED, remainingMs = remaining, endsAt = 0L)
    RestTimerNotifications.ensureChannels(context)
    RestTimerNotifications.notify(
      context,
      RestTimerNotifications.NOTIFICATION_RUNNING,
      RestTimerNotifications.pausedNotification(context, remaining)
    )
    commit(context, state)
  }

  fun resume(context: Context) {
    val current = getState(context)
    if (current.status != RestTimerStatus.PAUSED) return
    start(context, current.remainingMs)
  }

  fun reset(context: Context) {
    cancelAlarm(context)
    stopAlarmService(context)
    // A bolinha é encerrada antes de mexer na notificação: enquanto o serviço dela estiver em
    // foreground segurando a NOTIFICATION_RUNNING, um cancel() nesse id é ignorado pelo sistema.
    RestTimerBubble.dismiss(removeNotification = true)
    RestTimerNotifications.cancel(context, RestTimerNotifications.NOTIFICATION_RUNNING)
    RestTimerNotifications.cancel(context, RestTimerNotifications.NOTIFICATION_ALARM)
    commit(context, getState(context).copy(status = RestTimerStatus.IDLE, endsAt = 0L, remainingMs = 0L))
  }

  /** "+1 min": adia o alarme quando está correndo, ou vira um snooze de 1 min quando já tocou. */
  fun addMinute(context: Context) {
    val current = getState(context)
    when (current.status) {
      RestTimerStatus.RUNNING -> {
        val endsAt = current.endsAt + SNOOZE_MS
        scheduleAlarm(context, endsAt)
        RestTimerNotifications.notify(
          context,
          RestTimerNotifications.NOTIFICATION_RUNNING,
          RestTimerNotifications.runningNotification(context, endsAt)
        )
        commit(context, current.copy(endsAt = endsAt, totalMs = current.totalMs + SNOOZE_MS))
      }

      RestTimerStatus.PAUSED -> {
        val remaining = current.remainingMs + SNOOZE_MS
        RestTimerNotifications.notify(
          context,
          RestTimerNotifications.NOTIFICATION_RUNNING,
          RestTimerNotifications.pausedNotification(context, remaining)
        )
        commit(context, current.copy(remainingMs = remaining, totalMs = current.totalMs + SNOOZE_MS))
      }

      // Já tocou: "+1 min" vira soneca — para a vibração e recomeça uma contagem de 1 minuto.
      RestTimerStatus.FINISHED -> start(context, SNOOZE_MS)
      RestTimerStatus.IDLE -> Unit
    }
  }

  /** Chamado pelo alarme do sistema no instante do 00:00. */
  fun onAlarmFired(context: Context) {
    val current = getState(context)
    if (current.status != RestTimerStatus.RUNNING) return
    // Mesma ordem do reset: a bolinha sai antes, senão a notificação de contagem fica presa nela.
    RestTimerBubble.dismiss(removeNotification = true)
    RestTimerNotifications.cancel(context, RestTimerNotifications.NOTIFICATION_RUNNING)
    commit(context, current.copy(status = RestTimerStatus.FINISHED, endsAt = 0L, remainingMs = 0L))
    // O serviço posta a própria notificação (a de alarme) via startForeground e cuida da vibração.
    val intent = Intent(context, RestTimerAlarmService::class.java).setAction(ACTION_FIRE)
    ContextCompat.startForegroundService(context, intent)
  }

  fun stopAlarm(context: Context) {
    stopAlarmService(context)
    RestTimerNotifications.cancel(context, RestTimerNotifications.NOTIFICATION_ALARM)
    val current = getState(context)
    if (current.status == RestTimerStatus.FINISHED) {
      commit(context, current.copy(status = RestTimerStatus.IDLE, endsAt = 0L, remainingMs = 0L))
    }
  }

  fun setVibrationEnabled(context: Context, enabled: Boolean) {
    commit(context, getState(context).copy(vibrationEnabled = enabled))
  }

  fun setBubbleEnabled(context: Context, enabled: Boolean) {
    commit(context, getState(context).copy(bubbleEnabled = enabled))
  }

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val manager = context.getSystemService(AlarmManager::class.java) ?: return false
    return manager.canScheduleExactAlarms()
  }

  private fun commit(context: Context, state: RestTimerState) {
    RestTimerStore.save(context, state)
    // Funil único de mudança de estado: a bolinha se sincroniza aqui, venha a mudança do JS, do
    // botão da notificação ou do alarme.
    RestTimerBubble.sync(context, state)
    RestTimerEvents.emit(state)
  }

  private fun alarmPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, RestTimerActionReceiver::class.java).setAction(ACTION_FIRE)
    return PendingIntent.getBroadcast(
      context,
      REQUEST_ALARM,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun scheduleAlarm(context: Context, endsAt: Long) {
    val manager = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = alarmPendingIntent(context)
    // setAlarmClock é a variante mais protegida de todas (é a que os despertadores usam): imune a
    // Doze/otimização de bateria e, por ser um alarme exato, dá ao app o direito de iniciar um
    // foreground service estando em segundo plano — que é como a vibração acontece.
    if (canScheduleExactAlarms(context)) {
      manager.setAlarmClock(AlarmManager.AlarmClockInfo(endsAt, RestTimerNotifications.openAppIntent(context)), pending)
    } else {
      // Só cai aqui no Android 12 com a permissão revogada na mão: alarme inexato, pode atrasar.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pending)
    }
  }

  private fun cancelAlarm(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(alarmPendingIntent(context))
  }

  private fun stopAlarmService(context: Context) {
    context.stopService(Intent(context, RestTimerAlarmService::class.java))
  }
}
