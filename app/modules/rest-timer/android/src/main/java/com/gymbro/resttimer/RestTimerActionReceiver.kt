package com.gymbro.resttimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Recebe tanto o alarme do 00:00 quanto os toques nos botões da notificação. O Android cria o
 * processo do app só pra entregar o broadcast se ele estiver morto, e o `RestTimerController` lê
 * o estado do SharedPreferences — por isso Pausar/Retomar/Zerar funcionam sem o app estar aberto.
 */
class RestTimerActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val appContext = context.applicationContext
    when (intent.action) {
      RestTimerController.ACTION_FIRE -> RestTimerController.onAlarmFired(appContext)
      RestTimerController.ACTION_PAUSE -> RestTimerController.pause(appContext)
      RestTimerController.ACTION_RESUME -> RestTimerController.resume(appContext)
      RestTimerController.ACTION_RESET -> RestTimerController.reset(appContext)
      RestTimerController.ACTION_STOP_ALARM -> RestTimerController.stopAlarm(appContext)
      RestTimerController.ACTION_ADD_MINUTE -> RestTimerController.addMinute(appContext)
    }
  }
}
