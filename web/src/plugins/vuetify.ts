import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const THEME_STORAGE_KEY = 'gymbro-theme-mode'

function getInitialTheme(): 'gymBro' | 'gymBroDark' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark') return 'gymBroDark'
    if (stored === 'light') return 'gymBro'
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to light
  }
  return 'gymBro'
}

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
  },
  theme: {
    defaultTheme: getInitialTheme(),
    themes: {
      gymBro: {
        dark: false,
        colors: {
          background: '#f4f6f5',
          surface: '#ffffff',
          primary: '#15b580',
          secondary: '#12283a',
          success: '#15b580',
          info: '#2f6fa8',
          warning: '#d2902d',
          error: '#c94b3f',
          'on-success': '#ffffff',
          'on-error': '#ffffff',
        },
      },
      gymBroDark: {
        dark: true,
        colors: {
          background: '#0f1712',
          surface: '#17211b',
          primary: '#1fd08f',
          secondary: '#9fd6c9',
          success: '#1fd08f',
          info: '#6ba3d6',
          warning: '#e0a548',
          error: '#e08a7d',
          'on-success': '#ffffff',
          'on-error': '#ffffff',
        },
      },
    },
  },
  defaults: {
    global: {
      ripple: false,
    },
    VCard: {
      rounded: 'lg',
      elevation: 0,
    },
    VCardTitle: {
      class: 'text-body-1',
    },
    VBtn: {
      rounded: 'lg',
      height: 42,
      density: 'comfortable',
    },
    VTextField: {
      variant: 'outlined',
      color: 'primary',
      density: 'comfortable',
      hideDetails: 'auto',
      rounded: 'lg',
    },
    VTextarea: {
      variant: 'outlined',
      color: 'primary',
      density: 'comfortable',
      hideDetails: 'auto',
      rounded: 'lg',
    },
    VSelect: {
      variant: 'outlined',
      color: 'primary',
      density: 'comfortable',
      hideDetails: 'auto',
      rounded: 'lg',
    },
    VList: {
      density: 'comfortable',
    },
    VListItem: {
      minHeight: 48,
      rounded: 'lg',
    },
    VChip: {
      rounded: 'lg',
    },
    VAvatar: {
      rounded: 'lg',
    },
    VDialog: {
      rounded: 'lg',
    },
    VProgressCircular: {
      color: 'primary',
    },
    VTable: {
      density: 'comfortable',
    },
  },
})
