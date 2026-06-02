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
const description = 'Transform any file (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown completely in your browser. Fast, private, and secure.'

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
    <!-- Premium Header -->
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="hover:opacity-90 transition-opacity">
          <AppLogo class="h-8 shrink-0" />
        </NuxtLink>
      </template>

      <template #right>
        <!-- Light/Dark Mode Switcher -->
        <UColorModeButton />

        <!-- Github Reference to the original microsoft/markitdown concept -->
        <UButton
          to="https://github.com/microsoft/markitdown"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="Original Microsoft MarkItDown GitHub"
          color="neutral"
          variant="ghost"
          class="cursor-pointer"
        />
      </template>
    </UHeader>

    <!-- Main Workspace Area -->
    <UMain class="py-6 px-4 md:py-10">
      <NuxtPage />
    </UMain>

    <!-- Clean Solid Separator (Zero Gradients) -->
    <USeparator class="border-neutral-200 dark:border-neutral-800" />

    <!-- Premium Footer -->
    <UFooter class="px-4 py-6">
      <template #left>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          MarkDownify • Inspired by Microsoft MarkItDown • Zero servers. Zero tracking. 100% on-device.
        </p>
      </template>

      <template #right>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          © {{ new Date().getFullYear() }} MarkDownify Pro.
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
