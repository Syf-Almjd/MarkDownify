// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'MarkDownify - Universal File-to-Markdown Converter',
      htmlAttrs: {
        lang: 'en'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.' },
        { name: 'keywords', content: 'markdown, file converter, pdf to markdown, docx to markdown, excel to markdown, token saver, llm prompt optimizer, prompt token saver, claude mcp server, doc2md, on-device parsing, web mcp' },
        { name: 'author', content: 'SaifAlmajd' },
        { name: 'robots', content: 'index, follow' },
        { name: 'theme-color', content: '#00dc82' },

        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://markdownify.qzz.io/' },
        { property: 'og:title', content: 'MarkDownify - Universal File-to-Markdown Converter' },
        { property: 'og:description', content: 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.' },
        { property: 'og:image', content: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80' },

        // Twitter
        { property: 'twitter:card', content: 'summary_large_image' },
        { property: 'twitter:url', content: 'https://markdownify.qzz.io/' },
        { property: 'twitter:title', content: 'MarkDownify - Universal File-to-Markdown Converter' },
        { property: 'twitter:description', content: 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.' },
        { property: 'twitter:image', content: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://markdownify.qzz.io/' }
      ]
    }
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  devServer: {
    port: 3000
  },

  ssr: false,

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
