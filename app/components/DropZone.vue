<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'files-selected', files: FileList | File[]): void
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = () => {
  isDragging.value = false
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false

  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    emit('files-selected', e.dataTransfer.files)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('files-selected', target.files)
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

// Clipboard Paste Handler (Extremely premium user experience!)
const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
    emit('files-selected', Array.from(e.clipboardData.files))
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})
</script>

<template>
  <div
    class="relative border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all duration-300 select-none group focus:outline-none focus:ring-2 focus:ring-primary-500"
    :class="[
      isDragging
        ? 'border-primary-500 bg-primary-50/10 dark:bg-primary-950/10 scale-[1.01]'
        : 'border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/50 hover:bg-neutral-50/50 dark:hover:bg-neutral-900'
    ]"
    tabindex="0"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="triggerFileInput"
    @keydown.enter.prevent="triggerFileInput"
    @keydown.space.prevent="triggerFileInput"
  >
    <!-- Hidden input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden"
      @change="onFileSelect"
    >

    <div class="flex flex-col items-center justify-center gap-4">
      <!-- Animated Upload Icon Container -->
      <div
        class="w-16 h-16 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 group-hover:scale-110 group-hover:border-primary-400 transition-all duration-300"
        :class="[isDragging ? 'border-primary-500 text-primary-500 scale-110' : 'text-neutral-500']"
      >
        <UIcon
          name="i-lucide-upload-cloud"
          class="w-8 h-8"
          :class="[isDragging ? 'animate-bounce text-primary-500' : 'group-hover:text-primary-500 transition-colors']"
        />
      </div>

      <div class="space-y-1.5 max-w-md">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          Drag & drop your files here
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          Or <span class="text-primary-500 dark:text-primary-400 font-medium group-hover:underline">browse files</span> on your computer, or press <kbd class="px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">Ctrl + V</kbd> to paste
        </p>
      </div>

      <!-- Format Grid Tags -->
      <div class="mt-4 flex flex-wrap justify-center gap-2 max-w-xl">
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-file-text"
            class="w-3.5 h-3.5 text-blue-500"
          /> PDF
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-file-text"
            class="w-3.5 h-3.5 text-sky-500"
          /> Word
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-table-2"
            class="w-3.5 h-3.5 text-green-500"
          /> Excel / CSV
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-presentation"
            class="w-3.5 h-3.5 text-orange-500"
          /> PPTX
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-code"
            class="w-3.5 h-3.5 text-purple-500"
          /> HTML / JSON
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-image"
            class="w-3.5 h-3.5 text-pink-500"
          /> Images (OCR)
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          <UIcon
            name="i-lucide-headphones"
            class="w-3.5 h-3.5 text-yellow-500"
          /> Audio / Video
        </span>
      </div>
    </div>
  </div>
</template>
