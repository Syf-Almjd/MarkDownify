<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import { optimizeMarkdownContent, type OptimizationRules } from '~/utils/converter'

const props = defineProps<{
  fileName: string
  fileSize: number
  fileType: string
  markdown: string
  logs: string[]
  status: 'pending' | 'processing' | 'done' | 'error'
}>()

const emit = defineEmits<{
  (e: 'download', optimizedContent: string): void
}>()

// UI States
const activeTab = ref<'preview' | 'source' | 'logs'>('preview')
const viewMode = ref<'split' | 'single'>('split')
const isCopied = ref(false)

// Local file-level optimization rules (allows custom tweaking per document!)
const localRules = ref<OptimizationRules>({
  stripImages: false,
  stripLinks: false,
  collapseWhitespace: true,
  compactTables: false
})

// LLM Packaging drawer states
const xmlWrapping = ref(false)
const includeSystemPrompt = ref(false)
const wrapTagName = ref('document_context')

// Reactive Tab Switcher watch for ultimate UX response
watch(() => props.status, (newStatus) => {
  if (newStatus === 'processing' || newStatus === 'error') {
    activeTab.value = 'logs'
  } else if (newStatus === 'done') {
    activeTab.value = 'preview'
  }
}, { immediate: true })

// Reset local rules or presets depending on file type to be smart
watch(() => props.fileName, () => {
  const ext = props.fileName.split('.').pop()?.toLowerCase() || ''
  // Enable table compacting by default for spreadsheets
  localRules.value.compactTables = ['xlsx', 'xls', 'csv'].includes(ext)
  // Enable link stripping by default for html pages to save tokens
  localRules.value.stripLinks = ['html', 'htm'].includes(ext)
  localRules.value.stripImages = false
  localRules.value.collapseWhitespace = true
}, { immediate: true })

// 1. Dynamic Optimized Markdown computed property
const optimizedMarkdown = computed(() => {
  if (!props.markdown) return ''
  return optimizeMarkdownContent(props.markdown, localRules.value)
})

// 2. Wrap optimized markdown with LLM Packaging if selected
const packagedContent = computed(() => {
  let content = optimizedMarkdown.value
  if (xmlWrapping.value) {
    const tag = wrapTagName.value.trim() || 'document_context'
    const sizeStr = formattedSize.value
    content = `<${tag} name="${props.fileName}" type="${props.fileType}" size="${sizeStr}">\n${content}</${tag}>`
  }
  if (includeSystemPrompt.value) {
    const systemPrompt = `You are a high-capability AI assistant. Below is a token-optimized, high-fidelity markdown extraction of the file "${props.fileName}". Please ingest this document context, preserve all numeric spreadsheet values/tables, and reference this context to answer subsequent questions accurately:\n\n`
    content = systemPrompt + content
  }
  return content
})

// Configure marked to render simple HTML of the OPTIMIZED markdown
const renderedHtml = computed(() => {
  if (!optimizedMarkdown.value) return ''
  try {
    return marked.parse(optimizedMarkdown.value, {
      gfm: true,
      breaks: true
    })
  } catch (err) {
    console.error('Failed to parse markdown with marked:', err)
    return `<div class="p-4 text-red-500 border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-md">
      Failed to render preview. Showing raw text instead.
    </div>
    <pre class="mt-4 p-4 rounded bg-neutral-100 dark:bg-neutral-800 text-sm overflow-auto">${optimizedMarkdown.value}</pre>`
  }
})

// Copy to Clipboard with temporary checkmark animation
const copyToClipboard = async () => {
  if (!packagedContent.value) return
  try {
    await navigator.clipboard.writeText(packagedContent.value)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text:', err)
  }
}

// Friendly file size format
const formattedSize = computed(() => {
  if (props.fileSize < 1024) return `${props.fileSize} B`
  if (props.fileSize < 1024 * 1024) return `${(props.fileSize / 1024).toFixed(1)} KB`
  return `${(props.fileSize / (1024 * 1024)).toFixed(2)} MB`
})

// Estimate tokens for both original layout and optimized layout to show precise reduction
const originalTokens = computed(() => {
  if (!props.markdown) return 0
  return Math.max(1, Math.round(props.markdown.length / 4))
})

const optimizedTokens = computed(() => {
  if (!optimizedMarkdown.value) return 0
  return Math.max(1, Math.round(optimizedMarkdown.value.length / 4))
})

const tokenSavingsPercent = computed(() => {
  if (originalTokens.value === 0) return 0
  const savings = ((originalTokens.value - optimizedTokens.value) / originalTokens.value) * 100
  return Math.max(0, Math.round(savings))
})

// Trigger download of the currently optimized file
const triggerDownload = () => {
  emit('download', packagedContent.value)
}
</script>

<template>
  <div class="flex flex-col border border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900/60 glass-panel shadow-lg transition-colors duration-300 h-[650px] lg:h-[800px] relative">
    <!-- Component Glass Header Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 px-6 border-b border-neutral-200/60 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-900/60 backdrop-blur-md gap-3 relative z-10">
      <!-- File Metadata Details -->
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-500 shrink-0">
          <UIcon
            name="i-lucide-file-text"
            class="w-5 h-5"
          />
        </div>
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[240px] sm:max-w-[360px] tracking-tight">
            {{ fileName }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-1 font-medium">
            <span>{{ fileType }}</span>
            <span class="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span>{{ formattedSize }}</span>
          </p>
        </div>
      </div>

      <!-- Action & View Mode Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- View Mode selectors (Only relevant for large screens) -->
        <div class="hidden lg:flex items-center border border-neutral-200 dark:border-neutral-800/60 rounded-xl p-0.5 bg-white/50 dark:bg-neutral-950/50 shadow-inner">
          <button
            class="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
            :class="[
              viewMode === 'split'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
            ]"
            title="Split Workspace"
            @click="viewMode = 'split'"
          >
            <UIcon
              name="i-lucide-columns-2"
              class="w-3.5 h-3.5 text-primary-500"
            />
            Split View
          </button>
          <button
            class="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
            :class="[
              viewMode === 'single'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
            ]"
            title="Focus Workspace"
            @click="viewMode = 'single'"
          >
            <UIcon
              name="i-lucide-maximize-2"
              class="w-3.5 h-3.5"
            />
            Single View
          </button>
        </div>

        <!-- Copy / Download Actions -->
        <div class="flex items-center gap-2 ml-auto sm:ml-0">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            class="font-semibold rounded-xl cursor-pointer"
            :class="{ 'border-primary-500 text-primary-500 bg-primary-500/5': isCopied }"
            @click="copyToClipboard"
          >
            {{ isCopied ? 'Copied!' : 'Copy' }}
          </UButton>
          <UButton
            size="xs"
            color="primary"
            variant="solid"
            icon="i-lucide-download"
            class="font-semibold rounded-xl cursor-pointer shadow-sm hover:shadow shadow-primary-500/10"
            @click="triggerDownload"
          >
            Download .md
          </UButton>
        </div>
      </div>
    </div>

    <!-- High-Fidelity Real-Time Token Optimization Stats Cards -->
    <div class="bg-neutral-50/70 dark:bg-neutral-950/40 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-5 select-none relative overflow-hidden">
      <div class="absolute -top-12 -left-12 w-28 h-28 bg-primary-500/5 rounded-full blur-2xl pointer-events-none" />
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 shrink-0">
          <UIcon
            name="i-lucide-brain"
            class="w-5 h-5 animate-pulse"
          />
        </div>
        <div>
          <span class="font-extrabold text-neutral-900 dark:text-white flex items-center gap-2 text-sm md:text-base tracking-tight">
            Token Saver Engine Active
            <span 
              v-if="tokenSavingsPercent > 0"
              class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm"
            >
              -{{ tokenSavingsPercent }}% TOKENS
            </span>
          </span>
          <span class="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5 block leading-none font-medium">
            Customize local compression parameters on the fly below.
          </span>
        </div>
      </div>

      <!-- Token savings metric readout grid cards -->
      <div class="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0 relative z-10">
        <!-- Original Tokens Card -->
        <div class="bg-white/50 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl p-3 text-center min-w-[90px] md:min-w-[120px] shadow-sm hover:shadow-md transition-shadow">
          <p class="font-mono font-extrabold text-neutral-400 dark:text-neutral-500 text-xs md:text-sm leading-none">
            {{ originalTokens.toLocaleString() }}
          </p>
          <p class="text-[8px] md:text-[9px] text-neutral-450 dark:text-neutral-400 font-bold uppercase tracking-wider mt-2 leading-none">
            Original
          </p>
        </div>

        <!-- Squeezed Tokens Card -->
        <div class="bg-white/50 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/50 rounded-xl p-3 text-center min-w-[90px] md:min-w-[120px] shadow-sm hover:shadow-md transition-shadow ring-1 ring-primary-500/10">
          <p class="font-mono font-extrabold text-primary-500 text-xs md:text-sm leading-none">
            {{ optimizedTokens.toLocaleString() }}
          </p>
          <p class="text-[8px] md:text-[9px] text-primary-500 font-bold uppercase tracking-wider mt-2 leading-none">
            Squeezed
          </p>
        </div>

        <!-- Saved Tokens Card -->
        <div class="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-center min-w-[90px] md:min-w-[120px] shadow-sm hover:shadow-md transition-shadow">
          <p class="font-mono font-extrabold text-emerald-500 text-xs md:text-sm leading-none">
            {{ Math.max(0, originalTokens - optimizedTokens).toLocaleString() }}
          </p>
          <p class="text-[8px] md:text-[9px] text-emerald-550 dark:text-emerald-450 font-bold uppercase tracking-wider mt-2 leading-none">
            Saved
          </p>
        </div>
      </div>
    </div>

    <!-- Real-time Compression Controls & LLM Wrapper Toolbar (Solid layout) -->
    <div class="bg-neutral-50/20 dark:bg-neutral-900/10 border-b border-neutral-200 dark:border-neutral-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
      <!-- 1. Compression Rules -->
      <div class="space-y-2.5">
        <span class="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase block">
          Document Level Optimization Rules
        </span>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="localRules.stripImages"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            Strip Images
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="localRules.stripLinks"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            Strip Hyperlinks
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="localRules.collapseWhitespace"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            Collapse Whitespace
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="localRules.compactTables"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            Compact Tables
          </label>
        </div>
      </div>

      <!-- 2. LLM Packaging wrapper controls -->
      <div class="space-y-2.5 border-t md:border-t-0 pt-3 md:pt-0 border-neutral-200/60 dark:border-neutral-800/50">
        <span class="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase block">
          LLM Prompt Packaging Wrapper
        </span>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="xmlWrapping"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            XML Wrap
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-350 cursor-pointer select-none">
            <input 
              v-model="includeSystemPrompt"
              type="checkbox"
              class="rounded-full border-neutral-300 dark:border-neutral-700 text-primary-500 focus:ring-primary-500/40 w-4 h-4 cursor-pointer"
            />
            Prepend Prompter
          </label>
          <div 
            v-if="xmlWrapping"
            class="flex items-center gap-1.5 text-xs ml-1 transition-all duration-300"
          >
            <span class="text-neutral-400 font-mono">&lt;</span>
            <input 
              v-model="wrapTagName"
              type="text"
              class="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 text-[10px] w-28 focus:outline-none focus:ring-2 focus:ring-primary-500/40 text-neutral-800 dark:text-neutral-200 shadow-inner font-mono font-bold"
              placeholder="tag_name"
            />
            <span class="text-neutral-400 font-mono">&gt;</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Apple-style Glass Capsule Tab Selector -->
    <div
      class="border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/30 dark:bg-neutral-900/20 px-6 py-3 flex justify-start relative z-10"
      :class="{ 'lg:hidden': viewMode === 'split' }"
    >
      <div class="flex p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl relative shadow-inner w-full sm:w-auto">
        <button
          class="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 relative z-10 cursor-pointer text-center select-none"
          :class="[
            activeTab === 'preview'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          ]"
          @click="activeTab = 'preview'"
        >
          Rendered Preview
        </button>
        <button
          class="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 relative z-10 cursor-pointer text-center select-none"
          :class="[
            activeTab === 'source'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          ]"
          @click="activeTab = 'source'"
        >
          Markdown Source
        </button>
        <button
          class="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer text-center select-none"
          :class="[
            activeTab === 'logs'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm ring-1 ring-neutral-200/50 dark:ring-neutral-700/50'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          ]"
          @click="activeTab = 'logs'"
        >
          <span>Conversion Log</span>
          <span
            v-if="logs.length > 0"
            class="inline-flex items-center justify-center w-5 h-5 text-[9px] font-mono font-bold rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-750 dark:text-neutral-350"
          >
            {{ logs.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- Main Content Workspace Area -->
    <div class="relative flex-1 min-h-0 overflow-hidden bg-white dark:bg-neutral-950">
      <!-- Split-Pane View Mode (For Desktop Screens) -->
      <div
        v-if="viewMode === 'split'"
        class="hidden lg:grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-800 h-full"
      >
        <!-- Left Panel: Raw Monospace Markdown Textarea -->
        <div class="flex flex-col h-full overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-900/10 text-xs font-bold text-neutral-500 select-none">
            <span>PACKAGED OUTPUT</span>
            <span class="font-mono text-[10px]">{{ packagedContent.length }} chars</span>
          </div>
          <textarea
            readonly
            :value="packagedContent"
            class="flex-1 min-h-0 w-full p-4 font-mono text-sm leading-relaxed border-0 bg-neutral-50/20 dark:bg-neutral-950/80 resize-none outline-none select-text focus:ring-0 text-neutral-800 dark:text-neutral-300 overflow-y-auto"
            placeholder="No Markdown data generated"
          />
        </div>

        <!-- Right Panel: Beautiful typography HTML Preview -->
        <div class="flex flex-col h-full overflow-hidden bg-white dark:bg-neutral-950 select-text">
          <div class="flex items-center px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/20 dark:bg-neutral-900/10 text-xs font-bold text-neutral-500 select-none">
            <span>RENDERED PREVIEW</span>
          </div>
          <div class="flex-1 min-h-0 p-6 overflow-y-auto markdown-body">
            <div
              v-if="optimizedMarkdown"
              v-html="renderedHtml"
            />
            <div
              v-else
              class="flex flex-col items-center justify-center h-full text-neutral-400 select-none"
            >
              <UIcon
                name="i-lucide-eye"
                class="w-8 h-8 opacity-40 mb-2"
              />
              <p class="text-sm">
                Empty rendering preview
              </p>
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
          <div
            v-if="optimizedMarkdown"
            v-html="renderedHtml"
          />
          <div
            v-else
            class="flex flex-col items-center justify-center h-full text-neutral-400 select-none"
          >
            <UIcon
              name="i-lucide-eye"
              class="w-8 h-8 opacity-40 mb-2"
            />
            <p class="text-sm">
              Empty rendering preview
            </p>
          </div>
        </div>

        <!-- 2. Raw Markdown Tab -->
        <div
          v-show="activeTab === 'source'"
          class="flex flex-col h-full overflow-hidden"
        >
          <textarea
            readonly
            :value="packagedContent"
            class="w-full h-full p-6 font-mono text-sm leading-relaxed border-0 bg-neutral-50/20 dark:bg-neutral-950/80 resize-none outline-none select-text focus:ring-0 text-neutral-800 dark:text-neutral-300 overflow-y-auto"
            placeholder="No Markdown data generated"
          />
        </div>

        <!-- 3. Logs Tab -->
        <div
          v-show="activeTab === 'logs'"
          class="h-full p-6 overflow-y-auto font-mono text-xs leading-relaxed bg-neutral-900 text-neutral-300"
        >
          <div
            v-if="logs.length > 0"
            class="space-y-1.5"
          >
            <div
              v-for="(log, idx) in logs"
              :key="idx"
              class="flex items-start gap-2 border-b border-neutral-800/40 pb-1.5"
            >
              <span class="text-neutral-500">[{{ idx + 1 }}]</span>
              <span class="text-emerald-400 font-semibold">&gt;&gt;</span>
              <span class="flex-1 whitespace-pre-wrap text-left">{{ log }}</span>
            </div>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center h-full text-neutral-500 select-none"
          >
            <UIcon
              name="i-lucide-terminal"
              class="w-8 h-8 opacity-40 mb-2"
            />
            <p class="text-sm">
              No conversion logs logged
              
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
