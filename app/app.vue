<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'MarkDownify - Universal File-to-Markdown Converter'
const description = 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Save up to 70% of LLM tokens for GPT/Claude prompts.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&auto=format&fit=crop&q=80',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <!-- Background Glow Mesh Grid -->
    <div class="bg-mesh-glow bg-neutral-50 dark:bg-neutral-950 min-h-screen flex flex-col font-sans transition-colors duration-300 relative z-0">
      <!-- Premium Glass Header (Sticky, Translucent, Blurred) -->
      <UHeader class="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-neutral-900/70 border-b border-neutral-200/50 dark:border-neutral-800/40 px-6 py-4 transition-all duration-300 shadow-sm">
        <template #left>
          <NuxtLink
            to="/"
            class="hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <AppLogo class="h-8 shrink-0" />
          </NuxtLink>
        </template>

        <template #right>
          <div class="flex items-center gap-3">
            <!-- Light/Dark Mode Switcher -->
            <UColorModeButton class="hover:scale-105 active:scale-95 transition-transform" />

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
        </template>
      </UHeader>

      <!-- Main Workspace Area -->
      <UMain class="py-8 px-6 md:py-12 flex-1 relative z-10">
        <NuxtPage />
      </UMain>

      <!-- Premium Glass Footer -->
      <UFooter class="px-6 py-8 border-t border-neutral-200/50 dark:border-neutral-800/40 backdrop-blur-md bg-white/40 dark:bg-neutral-950/40 relative z-10 transition-colors duration-300">
        <template #left>
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
        </template>

        <template #right>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            © {{ new Date().getFullYear() }} MarkDownify Pro.
          </p>
        </template>
      </UFooter>
    </div>
  </UApp>
</template>
