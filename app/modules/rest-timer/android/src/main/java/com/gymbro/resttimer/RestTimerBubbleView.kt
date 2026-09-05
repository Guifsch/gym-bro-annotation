package com.gymbro.resttimer

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * A bolinha em si: uma janela `TYPE_APPLICATION_OVERLAY` do tamanho de um botão, desenhada por
 * cima de qualquer app. Não tem nada de React aqui — é uma `TextView` que o serviço atualiza a
 * cada segundo, justamente porque o JS pode estar congelado com o app em segundo plano.
 *
 * Gestos: arrastar move (livre, sem grudar na borda — o pedido era largar onde quiser), toque
 * curto abre o app, e segurar esconde a bolinha até o próximo play.
 */
class RestTimerBubbleView(
  private val context: Context,
  private val onTap: () -> Unit,
  private val onLongPress: () -> Unit
) {
  private val windowManager = context.getSystemService(WindowManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private val sizePx = dp(56f)

  private val label = TextView(context).apply {
    setTextColor(Color.WHITE)
    textSize = 13f
    gravity = Gravity.CENTER
    setTypeface(typeface, android.graphics.Typeface.BOLD)
    text = "--:--"
  }

  private val root = FrameLayout(context).apply {
    background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(RestTimerNotifications.BRAND_COLOR)
      setStroke(dp(2f), Color.argb(60, 255, 255, 255))
    }
    elevation = dp(6f).toFloat()
    addView(label, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
  }

  private val params = WindowManager.LayoutParams(
    sizePx,
    sizePx,
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    },
    // NOT_FOCUSABLE: a bolinha não rouba o teclado nem os toques do app que está por baixo.
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    PixelFormat.TRANSLUCENT
  ).apply {
    gravity = Gravity.TOP or Gravity.START
  }

  var isAttached = false
    private set

  private var downX = 0f
  private var downY = 0f
  private var initialX = 0
  private var initialY = 0
  private var dragging = false
  private var longPressFired = false
  private val longPressRunnable = Runnable {
    longPressFired = true
    onLongPress()
  }

  init {
    val saved = RestTimerStore.loadBubblePosition(context)
    val bounds = screenBounds()
    params.x = saved?.first ?: (bounds.width() - sizePx - dp(12f))
    params.y = saved?.second ?: (bounds.height() / 3)
    clampToScreen()
    installTouchListener()
  }

  fun setText(text: String) {
    label.text = text
  }

  fun attach() {
    if (isAttached) return
    clampToScreen()
    try {
      windowManager?.addView(root, params)
      isAttached = true
    } catch (_: Exception) {
      // Permissão revogada enquanto o timer rodava — sem bolinha, o timer segue normal.
    }
  }

  fun detach() {
    if (!isAttached) return
    try {
      windowManager?.removeView(root)
    } catch (_: Exception) {
      // View já removida pelo sistema.
    }
    isAttached = false
  }

  /** Rotação/mudança de tela: a bolinha pode ter ficado fora dos limites novos. */
  fun onConfigurationChanged() {
    if (!isAttached) return
    clampToScreen()
    try {
      windowManager?.updateViewLayout(root, params)
    } catch (_: Exception) {
    }
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun installTouchListener() {
    val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    val longPressTimeout = ViewConfiguration.getLongPressTimeout().toLong()

    root.setOnTouchListener { _: View, event: MotionEvent ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX
          downY = event.rawY
          initialX = params.x
          initialY = params.y
          dragging = false
          longPressFired = false
          handler.postDelayed(longPressRunnable, longPressTimeout)
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - downX
          val dy = event.rawY - downY
          if (!dragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) {
            dragging = true
            handler.removeCallbacks(longPressRunnable)
          }
          if (dragging) {
            params.x = initialX + dx.toInt()
            params.y = initialY + dy.toInt()
            clampToScreen()
            try {
              windowManager?.updateViewLayout(root, params)
            } catch (_: Exception) {
            }
          }
          true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          handler.removeCallbacks(longPressRunnable)
          if (dragging) {
            RestTimerStore.saveBubblePosition(context, params.x, params.y)
          } else if (!longPressFired && event.actionMasked == MotionEvent.ACTION_UP) {
            onTap()
          }
          dragging = false
          true
        }

        else -> false
      }
    }
  }

  private fun clampToScreen() {
    val bounds = screenBounds()
    params.x = params.x.coerceIn(0, (bounds.width() - sizePx).coerceAtLeast(0))
    params.y = params.y.coerceIn(0, (bounds.height() - sizePx).coerceAtLeast(0))
  }

  private fun screenBounds(): Rect {
    val manager = windowManager ?: return Rect(0, 0, 1080, 1920)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Rect(manager.currentWindowMetrics.bounds)
    } else {
      val metrics = context.resources.displayMetrics
      Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
    }
  }

  private fun dp(value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics).toInt()
}
