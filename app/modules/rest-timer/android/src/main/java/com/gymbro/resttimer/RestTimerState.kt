package com.gymbro.resttimer

import android.content.Context

enum class RestTimerStatus(val jsValue: String) {
  IDLE("idle"),
  RUNNING("running"),
  PAUSED("paused"),
  FINISHED("finished");

  companion object {
    fun fromStored(value: String?): RestTimerStatus =
      entries.firstOrNull { it.jsValue == value } ?: IDLE
  }
}

/**
 * Estado completo do timer. `endsAt` só faz sentido em RUNNING, `remainingMs` só em PAUSED —
 * mas os dois viajam sempre pro JS pra store não precisar adivinhar nada.
 */
data class RestTimerState(
  val status: RestTimerStatus = RestTimerStatus.IDLE,
  val endsAt: Long = 0L,
  val remainingMs: Long = 0L,
  val totalMs: Long = 0L,
  val vibrationEnabled: Boolean = true,
  val bubbleEnabled: Boolean = false
) {
  val isActive: Boolean
    get() = status == RestTimerStatus.RUNNING || status == RestTimerStatus.PAUSED

  fun toMap(): Map<String, Any> = mapOf(
    "status" to status.jsValue,
    "endsAt" to endsAt.toDouble(),
    "remainingMs" to remainingMs.toDouble(),
    "totalMs" to totalMs.toDouble(),
    "vibrationEnabled" to vibrationEnabled,
    "bubbleEnabled" to bubbleEnabled
  )
}

/**
 * Persistência em SharedPreferences — o processo do app morre com frequência enquanto o timer
 * roda (é exatamente o caso de uso), então o estado não pode viver só em memória: o
 * BroadcastReceiver dos botões da notificação precisa achá-lo intacto num processo recém-criado.
 */
object RestTimerStore {
  private const val PREFS = "rest_timer_state"
  private const val KEY_STATUS = "status"
  private const val KEY_ENDS_AT = "endsAt"
  private const val KEY_REMAINING = "remainingMs"
  private const val KEY_TOTAL = "totalMs"
  private const val KEY_VIBRATION = "vibrationEnabled"
  private const val KEY_BUBBLE = "bubbleEnabled"
  private const val KEY_BUBBLE_X = "bubbleX"
  private const val KEY_BUBBLE_Y = "bubbleY"

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun load(context: Context): RestTimerState {
    val prefs = prefs(context)
    return RestTimerState(
      status = RestTimerStatus.fromStored(prefs.getString(KEY_STATUS, null)),
      endsAt = prefs.getLong(KEY_ENDS_AT, 0L),
      remainingMs = prefs.getLong(KEY_REMAINING, 0L),
      totalMs = prefs.getLong(KEY_TOTAL, 0L),
      vibrationEnabled = prefs.getBoolean(KEY_VIBRATION, true),
      bubbleEnabled = prefs.getBoolean(KEY_BUBBLE, false)
    )
  }

  fun save(context: Context, state: RestTimerState) {
    prefs(context)
      .edit()
      .putString(KEY_STATUS, state.status.jsValue)
      .putLong(KEY_ENDS_AT, state.endsAt)
      .putLong(KEY_REMAINING, state.remainingMs)
      .putLong(KEY_TOTAL, state.totalMs)
      .putBoolean(KEY_VIBRATION, state.vibrationEnabled)
      .putBoolean(KEY_BUBBLE, state.bubbleEnabled)
      .apply()
  }

  /** Última posição em que a bolinha foi largada, pra ela nascer no mesmo lugar da próxima vez. */
  fun loadBubblePosition(context: Context): Pair<Int, Int>? {
    val prefs = prefs(context)
    if (!prefs.contains(KEY_BUBBLE_X)) return null
    return prefs.getInt(KEY_BUBBLE_X, 0) to prefs.getInt(KEY_BUBBLE_Y, 0)
  }

  fun saveBubblePosition(context: Context, x: Int, y: Int) {
    prefs(context).edit().putInt(KEY_BUBBLE_X, x).putInt(KEY_BUBBLE_Y, y).apply()
  }
}

/**
 * Ponte de volta pro JS. O módulo Expo se registra aqui enquanto está vivo; o receiver e os
 * serviços só chamam `emit` sem saber se tem alguém escutando (quando o app está morto, não tem —
 * e tudo bem, o JS relê `getState()` ao abrir).
 */
object RestTimerEvents {
  @Volatile
  var listener: ((RestTimerState) -> Unit)? = null

  fun emit(state: RestTimerState) {
    listener?.invoke(state)
  }
}
