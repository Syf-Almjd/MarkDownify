<script setup lang="ts">
import { ref, computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  fileName: string;
  fileSize: number;
  fileType: string;
  markdown: string;
  logs: string[];
}>();

const emit = defineEmits<{
  (e: 'download'): void;
}>();

// UI States
const activeTab = ref<'preview' | 'source' | 'logs'>('preview');
const viewMode = ref<'split' | 'single'>('split');
const isCopied = ref(false);

// Configure marked to render simple HTML
const renderedHtml = computed(() => {
  if (!props.markdown) return '';
  try {
    // Custom render configurations can go here
    return marked.parse(props.markdown, {
      gfm: true,
      breaks: true
    });
  } catch (err) {
    console.error('Failed to parse markdown with marked:', err);
    return `<div class="p-4 text-red-500 border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-md">
      Failed to render preview. Showing raw text instead.
    </div>
    <pre class="mt-4 p-4 rounded bg-neutral-100 dark:bg-neutral-800 text-sm overflow-auto">${props.markdown}</pre>`;
  }
});

// Copy to Clipboard with temporary checkmark animation
const copyToClipboard = async () => {
  if (!props.markdown) return;
  try {
    await navigator.clipboard.writeText(props.markdown);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
};

// Friendly file size format
const formattedSize = computed(() => {
  if (props.fileSize < 1024) return `${props.fileSize} B`;
  if (props.fileSize < 1024 * 1024) return `${(props.fileSize / 1024).toFixed(1)} KB`;
  return `${(props.fileSize / (1024 * 1024)).toFixed(2)} MB`;
});
</script>

<template>
  <div class="flex flex-col border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900/50 shadow-sm transition-colors duration-300">
    <!-- Component Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/80 gap-3">
      <!-- File Metadata Details -->
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
          <UIcon name="i-lucide-file-text" class="w-5 h-5 text-primary-500 dark:text-primary-400" />
        </div>
        <div class="min-w-0">
          <h4 class="text-sm font-semibold text-neutral-900 dark:text-white truncate max-w-[240px] sm:max-w-[360px]">
            {{ fileName }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
            <span>{{ fileType }}</span>
            <span class="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
            <span>{{ formattedSize }}</span>
          </p>
        </div>
      </div>

      <!-- Action & View Mode Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- View Mode selectors (Only relevant for large screens) -->
        <div class="hidden lg:flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 bg-white dark:bg-neutral-950">
          <button
            @click="viewMode = 'split'"
            class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
            :class="[
              viewMode === 'split'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
            ]"
            title="Split Workspace"
          >
            <UIcon name="i-lucide-columns-2" class="w-3.5 h-3.5" />
            Split View
          </button>
          <button
            @click="viewMode = 'single'"
            class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
            :class="[
              viewMode === 'single'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
            ]"
            title="Focus Workspace"
          >
            <UIcon name="i-lucide-maximize-2" class="w-3.5 h-3.5" />
            Single View
          </button>
        </div>

        <!-- Copy / Download Actions -->
        <div class="flex items-center gap-1.5 ml-auto sm:ml-0">
          <UButton
            @click="copyToClipboard"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            class="font-semibold cursor-pointer"
            :class="{ 'border-primary-500 text-primary-500 dark:text-primary-400': isCopied }"
          >
            {{ isCopied ? 'Copied!' : 'Copy' }}
          </UButton>
          <UButton
            @click="emit('download')"
            size="xs"
            color="primary"
            variant="solid"
            icon="i-lucide-download"
            class="font-semibold cursor-pointer"
          >
            Download .md
          </UButton>
        </div>
      </div>
    </div>

    <!-- Small Screens Tab Selector & Large Screens Single Mode Tab Bar -->
    <div 
      class="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/20 dark:bg-neutral-900/30 px-4 py-2 gap-2"
      :class="{ 'lg:hidden': viewMode === 'split' }"
    >
      <button
        @click="activeTab = 'preview'"
        class="px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer"
        :class="[
          activeTab === 'preview'
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
        ]"
      >
        Rendered Preview
      </button>
      <button
        @click="activeTab = 'source'"
        class="px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer"
        :class="[
          activeTab === 'source'
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
        ]"
      >
        Markdown Source
      </button>
      <button
        @click="activeTab = 'logs'"
        class="px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
        :class="[
          activeTab === 'logs'
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
        ]"
      >
        Conversion Log
        <span 
          v-if="logs.length > 0" 
          class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
        >
          {{ logs.length }}
        </span>
      </button>
    </div>

    <!-- Main Content Workspace Area -->
    <div class="relative flex-1 min-h-[400px] lg:min-h-[500px] max-h-[600px] overflow-hidden bg-white dark:bg-neutral-950">
      
      <!-- Split-Pane View Mode (For Desktop Screens) -->
      <div 
        v-if="viewMode === 'split'" 
        class="hidden lg:grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-800 h-full"
      >
        <!-- Left Panel: Raw Monospace Markdown Textarea -->
        <div class="flex flex-col h-full overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-900/10 text-xs font-bold text-neutral-500">
            <span>RAW MARKDOWN</span>
            <span class="font-mono">{{ markdown.length }} chars</span>
          </div>
          <textarea
            readonly
            :value="markdown"
            class="flex-1 w-full p-4 font-mono text-sm leading-relaxed border-0 bg-neutral-50/50 dark:bg-neutral-950/80 resize-none outline-none select-text focus:ring-0 text-neutral-800 dark:text-neutral-300 overflow-y-auto"
            placeholder="No Markdown data generated"
          ></textarea>
        </div>

        <!-- Right Panel: Beautiful typography HTML Preview -->
        <div class="flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-950 select-text">
          <div class="flex items-center px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-900/10 text-xs font-bold text-neutral-500">
            <span>RENDERED PREVIEW</span>
          </div>
          <div class="flex-1 p-6 overflow-y-auto markdown-body">
            <div v-if="markdown" v-html="renderedHtml"></div>
            <div v-else class="flex flex-col items-center justify-center h-full text-neutral-400">
              <UIcon name="i-lucide-eye" class="w-8 h-8 opacity-40 mb-2" />
              <p class="text-sm">Empty rendering preview</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Single / Tabbed View Mode (Mobile default or large screen focus option) -->
      <div 
        class="h-full overflow-hidden"
        :class="{ 'lg:hidden': viewMode === 'split' }"
      >
        <!-- 1. HTML Rendered Tab -->
        <div 
          v-show="activeTab === 'preview'" 
          class="h-full p-6 overflow-y-auto markdown-body select-text bg-white dark:bg-neutral-950"
        >
          <div v-if="markdown" v-html="renderedHtml"></div>
          <div v-else class="flex flex-col items-center justify-center h-full text-neutral-400">
            <UIcon name="i-lucide-eye" class="w-8 h-8 opacity-40 mb-2" />
            <p class="text-sm">Empty rendering preview</p>
          </div>
        </div>

        <!-- 2. Raw Markdown Tab -->
        <div v-show="activeTab === 'source'" class="flex flex-col h-full overflow-hidden">
          <textarea
            readonly
            :value="markdown"
            class="w-full h-full p-6 font-mono text-sm leading-relaxed border-0 bg-neutral-50/50 dark:bg-neutral-950/80 resize-none outline-none select-text focus:ring-0 text-neutral-800 dark:text-neutral-300 overflow-y-auto"
            placeholder="No Markdown data generated"
          ></textarea>
        </div>

        <!-- 3. Logs Tab -->
        <div 
          v-show="activeTab === 'logs'" 
          class="h-full p-6 overflow-y-auto font-mono text-xs leading-relaxed bg-neutral-900 text-neutral-300"
        >
          <div v-if="logs.length > 0" class="space-y-1.5">
            <div 
              v-for="(log, idx) in logs" 
              :key="idx" 
              class="flex items-start gap-2 border-b border-neutral-800/40 pb-1.5"
            >
              <span class="text-neutral-500">[{{ idx + 1 }}]</span>
              <span class="text-emerald-400 font-semibold">&gt;&gt;</span>
              <span class="flex-1 whitespace-pre-wrap">{{ log }}</span>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center h-full text-neutral-500">
            <UIcon name="i-lucide-terminal" class="w-8 h-8 opacity-40 mb-2" />
            <p class="text-sm">No conversion logs logged</p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
