import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ]
    }
  },
  future: {
    compatibilityVersion: 4,
  },
  // Configurazione NuxtHub
  hub: {
    database: true,
  },
  nitro: {
    experimental: {
      openAPI: true
    },
    storage: {
      attachments: {
        driver: 'fs',
        base: './storage',
      }
    },
  },
  compatibilityDate: '2025-05-15',
  devtools: { enabled: false },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/test-utils',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/mdc',
    '@pinia/nuxt',
    '@nuxthub/core'
  ],
  css: ['~/assets/css/main.css'],
  vite: {
    optimizeDeps: {
      include: ['debug']
    },
    plugins: [
      tailwindcss(),
    ],
    $server: {
      build: {
        rollupOptions: {
          output: {
            preserveModules: true
          }
        }
      }
    }
  },
  colorMode: {
    classPrefix: '',
    classSuffix: '',
    disableTransition: true,
    storageKey: 'theme',
    fallback: 'dark',
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },
  i18n: {
    bundle: {
      optimizeTranslationDirective: false,
    },
    detectBrowserLanguage: {
      useCookie: false,
      redirectOn: 'root',
    },
    baseUrl: import.meta.env.VITE_BASE_URL || 'http://localhost:3000',
    strategy: 'no_prefix',
    locales: [
      {
        code: 'en',
        name: 'English',
        language: 'en-US',
        file: 'en.ts'
      },
      {
        code: 'it',
        name: 'Italiano',
        language: 'it-IT',
        file: 'it.ts'
      }
    ],
    defaultLocale: 'en',
  },
  mdc: {
    components: {
      prose: true
    },
    highlight: {
      shikiEngine: 'javascript',
      theme: {
        dark: 'github-dark-default',
        light: 'github-light-default'
      }
    },
  },
  components: {
    "dirs": [
      {
        path: "~/components/prose",
        global: true,
        pathPrefix: false,
      },
      "~/components"
    ]
  },
  icon: {
    serverBundle: {
      collections: ["lucide"],
      externalizeIconsJson: true,
    },
  }
})