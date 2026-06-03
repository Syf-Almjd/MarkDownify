<script setup lang="ts">
import { ref } from 'vue'

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'canonical', href: 'https://markdownify.qzz.io/' }
  ],
  htmlAttrs: {
    lang: 'en'
  },
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'MarkDownify',
        'alternateName': 'Token Saver Studio',
        'url': 'https://markdownify.qzz.io/',
        'image': 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80',
        'description': 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.',
        'applicationCategory': 'DeveloperApplication, Utility',
        'operatingSystem': 'All',
        'browserRequirements': 'Requires JavaScript. Requires HTML5.',
        'creator': {
          '@type': 'Person',
          'name': 'SaifAlmajd',
          'url': 'https://github.com/Syf-Almjd'
        },
        'offers': {
          '@type': 'Offer',
          'price': '0.00',
          'priceCurrency': 'USD'
        }
      })
    }
  ]
})

const title = 'MarkDownify - Universal File-to-Markdown Converter'
const description = 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: 'https://markdownify.qzz.io/',
  ogImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80'
})

// Toast system for App share/support feedback
const toastMsg = ref<string | null>(null)
const showToast = (msg: string) => {
  toastMsg.value = msg
  setTimeout(() => {
    if (toastMsg.value === msg) {
      toastMsg.value = null
    }
  }, 3000)
}

const shareApp = async () => {
  const shareData = {
    title: 'MarkDownify',
    text: 'Convert any document into highly optimized, prompt-ready Markdown completely on-device. Save up to 70% of LLM tokens!',
    url: 'https://markdownify.qzz.io/'
  }

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData)
      showToast('Shared successfully!')
    } catch (err) {
      const error = err as Error
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error)
        copyToClipboard()
      }
    }
  } else {
    copyToClipboard()
  }
}

const copyToClipboard = () => {
  try {
    navigator.clipboard.writeText('https://markdownify.qzz.io/')
    showToast('App link copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy link:', err)
    showToast('Failed to copy share link.')
  }
}
</script>

<template>
  <UApp>
    <!-- Background Glow Mesh Grid -->
    <div class="bg-mesh-glow bg-neutral-50 dark:bg-neutral-950 min-h-screen flex flex-col font-sans transition-colors duration-300 relative z-0">
      <!-- Premium Glass Header (Sticky, Translucent, Blurred) -->
      <header class="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-neutral-900/70 border-b border-neutral-200/50 dark:border-neutral-800/40 w-full transition-all duration-300 shadow-sm">
        <div class="max-w-7xl mx-auto flex items-center justify-between py-4 pl-0 pr-6 md:pr-8">
          <NuxtLink
            to="/"
            class="hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <AppLogo class="h-8 shrink-0" />
          </NuxtLink>

          <div class="flex items-center gap-3">
            <!-- Light/Dark Mode Switcher -->
            <UColorModeButton class="hover:scale-105 active:scale-95 transition-transform" />

            <!-- Share Button -->
            <UButton
              icon="i-lucide-share-2"
              aria-label="Share MarkDownify"
              color="neutral"
              variant="ghost"
              class="cursor-pointer hover:scale-105 hover:text-primary-500 active:scale-95 transition-all text-neutral-500 dark:text-neutral-400"
              title="Share MarkDownify"
              @click="shareApp"
            />

            <!-- Support / Sponsor Button -->
            <UButton
              to="https://github.com/sponsors/Syf-Almjd"
              target="_blank"
              icon="i-lucide-heart"
              aria-label="Sponsor SaifAlmajd on GitHub"
              color="neutral"
              variant="ghost"
              class="cursor-pointer hover:scale-105 hover:text-rose-500 active:scale-95 transition-all text-neutral-500 dark:text-neutral-400"
              title="Sponsor & Support"
            />

            <!-- Github Reference with elegant micro-hover scale -->
            <UButton
              to="https://github.com/Syf-Almjd/cli-doc2md-mcp"
              target="_blank"
              icon="i-simple-icons-github"
              aria-label="SaifAlmajd MarkDownify GitHub"
              color="neutral"
              variant="ghost"
              class="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            />
          </div>
        </div>
      </header>

      <!-- Main Workspace Area -->
      <main class="py-8 px-6 md:py-12 flex-1 relative z-10 w-full max-w-7xl mx-auto">
        <NuxtPage />
      </main>

      <!-- Premium Glass Footer -->
      <footer class="border-t border-neutral-200/50 dark:border-neutral-800/40 backdrop-blur-md bg-white/40 dark:bg-neutral-950/40 relative z-10 transition-colors duration-300 py-8 px-6 md:px-8">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1 flex-wrap">
            <span>Developed by</span>
            <NuxtLink
              to="https://github.com/Syf-Almjd"
              target="_blank"
              class="text-neutral-800 dark:text-neutral-200 font-bold hover:text-primary-500 dark:hover:text-primary-400 hover:underline transition-all flex items-center gap-0.5"
            >
              SaifAlmajd (@Syf-Almjd)
            </NuxtLink>
            <span class="mx-1.5">•</span>
            <span>Zero servers. Zero tracking. 100% on-device parser.</span>
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            © {{ new Date().getFullYear() }} MarkDownify.
          </p>
        </div>
      </footer>
    </div>

    <!-- Toast Notification (Zero-Gradient solid panel) -->
    <Transition name="fade">
      <div
        v-if="toastMsg"
        class="fixed bottom-6 right-6 px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-900 text-white dark:border-neutral-200 dark:bg-white dark:text-neutral-900 shadow-xl text-sm font-semibold flex items-center gap-2 z-50 transition-all duration-300 select-none"
      >
        <UIcon
          name="i-lucide-info"
          class="w-4 h-4 text-primary-500"
        />
        {{ toastMsg }}
      </div>
    </Transition>
  </UApp>
</template>

<style scoped>
/* Toast transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
