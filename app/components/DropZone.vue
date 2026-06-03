<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  compact?: boolean
}>()

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
    class="relative border-2 border-dashed cursor-pointer transition-all duration-300 select-none group focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-sm"
    :class="[
      compact ? 'rounded-xl p-4' : 'rounded-2xl p-8 md:p-12 hover:shadow-lg',
      isDragging
        ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-500/10 ring-4 ring-primary-500/10 scale-[1.01]'
        : 'glass-panel border-neutral-300 dark:border-neutral-800/80 hover:border-primary-500/40 hover:-translate-y-0.5'
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

    <div :class="['flex flex-col items-center justify-center', compact ? 'gap-2' : 'gap-4']">
      <!-- Animated Upload Icon Container -->
      <div
        class="rounded-xl flex items-center justify-center border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900 group-hover:scale-105 group-hover:border-primary-400 group-hover:shadow-md transition-all duration-300"
        :class="[
          compact ? 'w-10 h-10' : 'w-16 h-16 rounded-2xl',
          isDragging ? 'border-primary-500 text-primary-500 scale-105 shadow-md' : 'text-neutral-500'
        ]"
      >
        <UIcon
          name="i-lucide-upload-cloud"
          :class="[compact ? 'w-5 h-5' : 'w-8 h-8', isDragging ? 'animate-bounce text-primary-500' : 'group-hover:text-primary-500 transition-colors']"
        />
      </div>

      <div class="space-y-1 max-w-md text-center">
        <h3 :class="['font-bold text-neutral-900 dark:text-white tracking-tight', compact ? 'text-xs' : 'text-lg']">
          {{ compact ? 'Drop files here or click' : 'Drag & drop your files here' }}
        </h3>
        <p
          v-if="!compact"
          class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed"
        >
          Or <span class="text-primary-500 dark:text-primary-400 font-semibold group-hover:underline">browse files</span> on your computer, or press <kbd class="px-2 py-0.5 font-mono text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 shadow-sm">Ctrl + V</kbd> to paste
        </p>
      </div>

      <!-- Format Grid Tags (Only visible when not compact) -->
      <div
        v-if="!compact"
        class="mt-4 flex flex-wrap justify-center gap-2 max-w-xl"
      >
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-file-text"
            class="w-3.5 h-3.5 text-blue-500"
          /> PDF
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-file-text"
            class="w-3.5 h-3.5 text-sky-500"
          /> Word
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-table-2"
            class="w-3.5 h-3.5 text-green-500"
          /> Excel / CSV
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-presentation"
            class="w-3.5 h-3.5 text-orange-500"
          /> PPTX
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-code"
            class="w-3.5 h-3.5 text-purple-500"
          /> HTML / Code
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-image"
            class="w-3.5 h-3.5 text-pink-500"
          /> Images (OCR)
        </span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-700 dark:text-neutral-300 shadow-sm hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-md transition-all duration-200 select-none">
          <UIcon
            name="i-lucide-headphones"
            class="w-3.5 h-3.5 text-yellow-500"
          /> Audio / Video
        </span>
      </div>
    </div>
  </div>
</template>
