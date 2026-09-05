package com.gymbro.resttimer

import android.app.Activity
import android.app.ActivityManager
import android.app.Application
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Decide quando a bolinha existe. É chamado de dentro do `commit()` do controller, ou seja: de
 * qualquer origem de mudança de estado (JS, botão da notificação, alarme).
 */
object RestTimerBubble {
  @Volatile
  var service: RestTimerBubbleService? = null

  fun canDrawOverlays(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

  fun sync(context: Context, state: RestTimerState) {
    val wantsBubble = state.bubbleEnabled && state.isActive && canDrawOverlays(context)
    // Um serviço que já pediu pra morrer não serve: o caso real é o "+1 min" depois do alarme,
    // que reinicia o timer enquanto o serviço anterior ainda está sendo destruído.
    val running = service?.takeIf { !it.isFinishing }

    if (wantsBubble) {
      if (running == null) startService(context) else running.onStateChanged(state)
      return
    }

    // Timer acabou/zerou → a notificação de contagem tem que sumir junto com o serviço.
    // Bolinha só desligada no switch → a notificação continua, agora sem dono em foreground.
    running?.finish(removeNotification = !state.isActive)
  }

  fun dismiss(removeNotification: Boolean) {
    service?.finish(removeNotification)
  }

  private fun startService(context: Context) {
    try {
      ContextCompat.startForegroundService(context, Intent(context, RestTimerBubbleService::class.java))
    } catch (_: Exception) {
      // Android 12+ barra subir foreground service em segundo plano fora das isenções. O
      // "Retomar" da notificação tem isenção, mas se algum caminho não tiver, o timer segue
      // normal — só sem bolinha até o próximo play com o app aberto.
    }
  }
}

/**
 * Foreground service que segura a bolinha. Precisa ser foreground por dois motivos: em segundo
 * plano o Android congela o processo (a contagem da bolinha pararia de atualizar) e pode matá-lo
 * (a bolinha sumiria sozinha).
 *
 * Ele **adota a notificação de contagem que já existe** (`NOTIFICATION_RUNNING`) como notificação
 * de foreground, em vez de postar uma segunda — o usuário continua vendo uma notificação só.
 */
class RestTimerBubbleService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var bubble: RestTimerBubbleView? = null
  private var visibleActivities = 0
  private var hiddenForRun = false
  private var finishing = false
  private var lastStatus = RestTimerStatus.IDLE

  val isFinishing: Boolean
    get() = finishing

  private val tickRunnable = object : Runnable {
    override fun run() {
      renderCurrentState()
      handler.postDelayed(this, TICK_MS)
    }
  }

  private val activityCallbacks = object : Application.ActivityLifecycleCallbacks {
    override fun onActivityStarted(activity: Activity) {
      visibleActivities++
      syncVisibility()
    }

    override fun onActivityStopped(activity: Activity) {
      visibleActivities = (visibleActivities - 1).coerceAtLeast(0)
      syncVisibility()
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityResumed(activity: Activity) = Unit
    override fun onActivityPaused(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    RestTimerBubble.service = this
    // Estado inicial: o serviço costuma subir com o app ainda aberto (o usuário acabou de dar
    // play), e não há callback retroativo pra saber disso — o importance do processo tem.
    visibleActivities = if (isAppInForeground()) 1 else 0
    (applicationContext as? Application)?.registerActivityLifecycleCallbacks(activityCallbacks)
    bubble = RestTimerBubbleView(
      context = this,
      onTap = { openApp() },
      onLongPress = { hideForThisRun() }
    )
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    RestTimerNotifications.ensureChannels(this)
    // Um start novo chegando antes do stopSelf() concluir cancela a parada — o serviço volta a
    // valer, então o flag de encerramento tem que voltar a false junto.
    finishing = false
    val state = RestTimerStore.load(this)
    lastStatus = state.status
    startAsForeground(state)
    syncVisibility()
    handler.removeCallbacks(tickRunnable)
    handler.post(tickRunnable)
    return START_NOT_STICKY
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    bubble?.onConfigurationChanged()
  }

  override fun onDestroy() {
    handler.removeCallbacks(tickRunnable)
    bubble?.detach()
    bubble = null
    (applicationContext as? Application)?.unregisterActivityLifecycleCallbacks(activityCallbacks)
    if (RestTimerBubble.service === this) RestTimerBubble.service = null
    super.onDestroy()
  }

  fun onStateChanged(state: RestTimerState) {
    // "Esconder" pela pressão longa vale até o próximo play — inclusive o play que retoma de uma
    // pausa, que é uma volta ao RUNNING como qualquer outra.
    if (state.status == RestTimerStatus.RUNNING && lastStatus != RestTimerStatus.RUNNING) {
      hiddenForRun = false
    }
    lastStatus = state.status
    // Repostar via startForeground mantém a notificação de contagem sob o serviço (um notify()
    // solto no mesmo id não muda quem é o dono do foreground).
    startAsForeground(state)
    renderCurrentState()
    syncVisibility()
  }

  fun finish(removeNotification: Boolean) {
    if (finishing) return
    finishing = true
    handler.removeCallbacks(tickRunnable)
    bubble?.detach()
    ServiceCompat.stopForeground(
      this,
      if (removeNotification) ServiceCompat.STOP_FOREGROUND_REMOVE else ServiceCompat.STOP_FOREGROUND_DETACH
    )
    stopSelf()
  }

  private fun startAsForeground(state: RestTimerState) {
    val notification = RestTimerNotifications.forState(this, state)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        RestTimerNotifications.NOTIFICATION_RUNNING,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else {
      startForeground(RestTimerNotifications.NOTIFICATION_RUNNING, notification)
    }
  }

  private fun renderCurrentState() {
    val state = RestTimerStore.load(this)
    if (!state.isActive) return
    val remainingMs =
      if (state.status == RestTimerStatus.PAUSED) state.remainingMs
      else (state.endsAt - System.currentTimeMillis()).coerceAtLeast(0L)
    bubble?.setText(RestTimerNotifications.formatRemaining(remainingMs))
  }

  /** A bolinha só aparece com o app fora da tela — dentro dele já existe a barra fixa do timer. */
  private fun syncVisibility() {
    val shouldShow = !hiddenForRun && visibleActivities == 0 && RestTimerStore.load(this).isActive
    if (shouldShow) {
      renderCurrentState()
      bubble?.attach()
    } else {
      bubble?.detach()
    }
  }

  private fun hideForThisRun() {
    hiddenForRun = true
    bubble?.detach()
  }

  private fun openApp() {
    val intent = RestTimerNotifications.openAppRawIntent(this) ?: return
    try {
      // Abrir activity a partir de um serviço em segundo plano é restrito desde o Android 10; ter
      // uma janela de overlay visível (a própria bolinha) é uma das isenções. Se algum fabricante
      // barrar mesmo assim, a notificação continua sendo o caminho de voltar pro app.
      startActivity(intent)
    } catch (_: Exception) {
    }
  }

  private fun isAppInForeground(): Boolean {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    // Com o serviço em foreground o importance já é FOREGROUND_SERVICE (125); só uma activity
    // visível derruba pra FOREGROUND (100).
    return info.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  private companion object {
    const val TICK_MS = 1000L
  }
}
