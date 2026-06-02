<script setup lang="ts">
/* eslint-disable */
import { ref, computed, onMounted } from 'vue'
import { convertFile } from '~/utils/converter'
import JSZip from 'jszip'

interface FileItem {
  id: string
  file?: File // Optional for serialized localStorage items
  name: string
  size: number
  type: string
  status: 'pending' | 'processing' | 'done' | 'error'
  markdown: string
  fileTypeLabel: string
  progressMsg: string
  logs: string[]
}

// State variables
const filesQueue = ref<FileItem[]>([])
const selectedFileId = ref<string | null>(null)
const isProcessing = ref(false)
const ocrEnabled = ref(false)

// Toast system
const toastMsg = ref<string | null>(null)
const showToast = (msg: string) => {
  toastMsg.value = msg
  setTimeout(() => {
    if (toastMsg.value === msg) {
      toastMsg.value = null
    }
  }, 3000)
}

// Caching conversions in LocalStorage to preserve Workspace History
const loadHistoryFromCache = () => {
  if (typeof window === 'undefined') return
  try {
    const cached = localStorage.getItem('markdownify_history_v2')
    if (cached) {
      const items = JSON.parse(cached) as FileItem[]
      // Re-instantiate without the raw browser File handles
      filesQueue.value = items.map(item => ({
        ...item,
        file: undefined // File handles are single-session only
      }))
      
      // Auto-select first done item if exists
      const firstDone = filesQueue.value.find(f => f.status === 'done')
      if (firstDone) {
        selectedFileId.value = firstDone.id
      }
    }
  } catch (err) {
    console.error('Failed to parse workspace history cache:', err)
  }
}

const saveHistoryToCache = () => {
  if (typeof window === 'undefined') return
  try {
    // Only serialize completed, failed, or static pending queue items
    // (Strip File handles to avoid browser serialization blocks)
    const serializable = filesQueue.value.map(({ file, ...rest }) => rest)
    localStorage.setItem('markdownify_history_v2', JSON.stringify(serializable))
  } catch (err) {
    console.warn('Workspace history too large for default localStorage. Cleaning oldest items...', err)
    // Cleanup oldest items if quota exceeded (sliding window of 5 items)
    if (filesQueue.value.length > 5) {
      const itemsToKeep = filesQueue.value.slice(-5)
      const serializable = itemsToKeep.map(({ file, ...rest }) => rest)
      localStorage.setItem('markdownify_history_v2', JSON.stringify(serializable))
    }
  }
}

// Initialize history workspace cache
onMounted(() => {
  loadHistoryFromCache()
})

// Computed properties
const selectedFile = computed(() => {
  return filesQueue.value.find(f => f.id === selectedFileId.value) || null
})

const totalFiles = computed(() => filesQueue.value.length)
const completedCount = computed(() => filesQueue.value.filter(f => f.status === 'done').length)

// Total Savings Stats across this Workspace Session
const totalOriginalTokens = computed(() => {
  return filesQueue.value
    .filter(f => f.status === 'done')
    .reduce((sum, item) => sum + Math.max(1, Math.round(item.markdown.length / 4 * 1.5)), 0) // rough original ratio estimation
})

const totalSavedTokens = computed(() => {
  const currentDone = filesQueue.value.filter(f => f.status === 'done')
  const squeezed = currentDone.reduce((sum, item) => sum + Math.max(1, Math.round(item.markdown.length / 4)), 0)
  const savings = totalOriginalTokens.value - squeezed
  return Math.max(0, savings)
})

const totalSavingsPercent = computed(() => {
  if (totalOriginalTokens.value === 0) return 0
  return Math.round((totalSavedTokens.value / totalOriginalTokens.value) * 100)
})

// Handle adding files to queue
const onFilesSelected = (files: FileList | File[]) => {
  const newFiles = Array.from(files)
  const itemsToAdd: FileItem[] = []

  newFiles.forEach((file) => {
    if (filesQueue.value.some(f => f.name === file.name)) {
      showToast(`"${file.name}" is already in the workspace list.`)
      return
    }

    const item: FileItem = {
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      markdown: '',
      fileTypeLabel: 'Pending conversion',
      progressMsg: 'Queued',
      logs: ['Document added to the active workspace.']
    }

    itemsToAdd.push(item)
  })

  if (itemsToAdd.length > 0) {
    filesQueue.value.push(...itemsToAdd)
    showToast(`Added ${itemsToAdd.length} document(s) to workspace.`)
    saveHistoryToCache()

    // Automatically trigger queue processing if not already running
    if (!isProcessing.value) {
      processQueue()
    }
  }
}

// Process queue sequentially
const processQueue = async () => {
  if (isProcessing.value) return

  const nextItem = filesQueue.value.find(f => f.status === 'pending')
  if (!nextItem) {
    isProcessing.value = false
    saveHistoryToCache()
    return
  }

  isProcessing.value = true
  nextItem.status = 'processing'
  nextItem.progressMsg = 'Extracting layers...'
  nextItem.logs.push('Initializing document conversion worker...')

  try {
    // If the file handle was lost (e.g. loaded from cache but status was pending), throw error
    if (!nextItem.file) {
      throw new Error('Local file handle expired due to session restart. Please re-upload.')
    }

    const result = await convertFile(nextItem.file, { runOcr: ocrEnabled.value }, (progress) => {
      nextItem.progressMsg = progress
      nextItem.logs.push(progress)
    })

    nextItem.markdown = result.markdown
    nextItem.fileTypeLabel = result.fileType
    nextItem.status = 'done'
    nextItem.progressMsg = 'Completed'
    nextItem.logs.push(`Conversion successful. Output size: ${result.markdown.length} characters.`)

    // Auto-select completed file to guide user
    selectedFileId.value = nextItem.id
    saveHistoryToCache()
  } catch (err: any) {
    console.error(`Error converting ${nextItem.name}:`, err)
    nextItem.status = 'error'
    nextItem.progressMsg = 'Conversion failed'
    nextItem.logs.push(`[ERROR] Conversion aborted: ${err.message || 'Unknown parsing exception'}`)
    saveHistoryToCache()
  }

  isProcessing.value = false
  // Process next item recursively
  processQueue()
}

// Remove single file
const removeFile = (id: string) => {
  const index = filesQueue.value.findIndex(f => f.id === id)
  if (index !== -1) {
    const name = filesQueue.value[index]?.name
    filesQueue.value.splice(index, 1)

    if (selectedFileId.value === id) {
      const nextDone = filesQueue.value.find(f => f.status === 'done')
      selectedFileId.value = nextDone ? nextDone.id : null
    }

    showToast(`Removed "${name}" from workspace.`)
    saveHistoryToCache()
  }
}

// Clear entire conversion workspace
const clearQueue = () => {
  filesQueue.value = []
  selectedFileId.value = null
  isProcessing.value = false
  if (typeof window !== 'undefined') {
    localStorage.removeItem('markdownify_history_v2')
  }
  showToast('Workspace history cleared.')
}

// Download optimized file
const downloadSingleFile = (item: FileItem, optimizedContent?: string) => {
  if (item.status !== 'done') return
  const baseName = item.name.replace(/\.[^/.]+$/, '')
  const contentToDownload = optimizedContent || item.markdown
  const blob = new Blob([contentToDownload], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}.md`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`Downloaded "${baseName}.md"`)
}

// Download all completed conversions as a ZIP archive
const downloadAllAsZip = async () => {
  const completed = filesQueue.value.filter(f => f.status === 'done')
  if (completed.length === 0) return

  const zip = new JSZip()
  completed.forEach((item) => {
    const baseName = item.name.replace(/\.[^/.]+$/, '')
    zip.file(`${baseName}.md`, item.markdown)
  })

  try {
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = 'markdownify_optimized_archive.zip'
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded all conversions as ZIP archive.')
  } catch (err) {
    console.error('Failed to create ZIP package:', err)
    showToast('ZIP generation failed.')
  }
}

// --- INTERACTIVE TOKEN & COST SAVINGS CALCULATOR STATE ---
const docsPerMonth = ref(300)
const avgDocSizeKb = ref(150)
const selectedModel = ref<'sonnet' | 'gpt4o' | 'gemini' | 'haiku'>('sonnet')

const llmModels: Record<'sonnet' | 'gpt4o' | 'gemini' | 'haiku', { name: string, inputCost: number, outputCost: number }> = {
  sonnet: { name: 'Claude 3.5 Sonnet', inputCost: 3.00, outputCost: 15.00 },
  gpt4o: { name: 'GPT-4o (Omni)', inputCost: 5.00, outputCost: 15.00 },
  gemini: { name: 'Gemini 1.5 Pro', inputCost: 1.25, outputCost: 5.00 },
  haiku: { name: 'Claude 3.5 Haiku', inputCost: 0.25, outputCost: 1.25 }
}

const calculatorStats = computed(() => {
  const model = llmModels[selectedModel.value]
  // Roughly 1KB of mixed document yields ~800 tokens originally (heavy metadata, tags, layout)
  // Converting it to optimized clean markdown drops token count to ~240 (70% savings)
  const originalTokens = docsPerMonth.value * (avgDocSizeKb.value * 800)
  const optimizedTokens = originalTokens * 0.3
  const savedTokens = originalTokens * 0.7

  // API Call pricing model (assume 80% prompt inputs and 20% output responses)
  const avgCostPer1MTokens = (model.inputCost * 0.8) + (model.outputCost * 0.2)
  const monthlyCostOriginal = (originalTokens / 1000000) * avgCostPer1MTokens
  const monthlyCostOptimized = (optimizedTokens / 1000000) * avgCostPer1MTokens
  const monthlySavings = Math.max(0, monthlyCostOriginal - monthlyCostOptimized)
  const annualSavings = monthlySavings * 12

  return {
    originalTokens,
    optimizedTokens,
    savedTokens,
    monthlySavings,
    annualSavings
  }
})
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-8 font-sans">
    <!-- Hero / Title Section (Zero-Gradient Sleek Design) -->
    <div class="border-b border-neutral-200 dark:border-neutral-800 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div class="space-y-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wide bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300">
          Open-Source Workspace
        </span>
        <h1 class="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
          Token Saver <span class="text-primary-500">Studio</span>
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
          Cleanly extract document content into highly optimized, prompt-ready Markdown completely on-device. 
          Save up to **70% of LLM tokens** for massive API savings and precision prompts.
        </p>
      </div>

      <!-- Quick Session Stats glass badge -->
      <div 
        v-if="completedCount > 0"
        class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-4 flex items-center gap-5 shrink-0 shadow-md relative overflow-hidden"
      >
        <div class="absolute -top-6 -right-6 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        <div class="text-left">
          <p class="font-mono font-extrabold text-emerald-500 text-base leading-none tracking-tight">
            -{{ totalSavingsPercent }}%
          </p>
          <p class="text-[9px] text-neutral-500 dark:text-neutral-400 font-extrabold uppercase tracking-wider mt-1.5 leading-none">
            Total Squeeze
          </p>
        </div>
        <div class="h-8 w-px bg-neutral-200/60 dark:bg-neutral-800/60" />
        <div class="text-left">
          <p class="font-mono font-extrabold text-primary-500 text-base leading-none tracking-tight">
            {{ totalSavedTokens.toLocaleString() }}
          </p>
          <p class="text-[9px] text-neutral-500 dark:text-neutral-400 font-extrabold uppercase tracking-wider mt-1.5 leading-none">
            Tokens Saved
          </p>
        </div>
      </div>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- LEFT COLUMN: Uploader & File Queue List (Grid Span 4) -->
      <div class="lg:col-span-4 space-y-6">
        <!-- Drag & Drop Uploader Panel -->
        <DropZone @files-selected="onFilesSelected" />

        <!-- Converter Settings Card (Glassmorphic) -->
        <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/50 rounded-2xl p-5 space-y-5 shadow-sm hover:shadow-md transition-all duration-300">
          <div class="flex items-center justify-between">
            <h3 class="text-[10px] font-extrabold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
              Global Workspace Controls
            </h3>

            <button
              v-if="filesQueue.length > 0"
              class="text-xs font-semibold text-neutral-500 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
              @click="clearQueue"
            >
              <UIcon
                name="i-lucide-trash-2"
                class="w-3.5 h-3.5"
              />
              Clear Workspace
            </button>
          </div>

          <div class="space-y-4">
            <!-- OCR Toggler -->
            <div class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/40 pb-3">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                  On-Device Image OCR
                </span>
                <p class="text-[10px] text-neutral-500 leading-normal">
                  Read text inside images dynamically
                </p>
              </div>
              <USwitch
                v-model="ocrEnabled"
                color="primary"
                aria-label="Toggle Image OCR"
              />
            </div>

            <!-- ZIP Bulk Downloader & Counters -->
            <div
              v-if="filesQueue.length > 0"
              class="pt-1 space-y-4"
            >
              <div class="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-400">
                <span>Completed Conversions:</span>
                <span class="text-neutral-900 dark:text-white font-mono bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded">{{ completedCount }} / {{ totalFiles }}</span>
              </div>

              <UButton
                v-if="completedCount > 0"
                color="primary"
                variant="subtle"
                block
                icon="i-lucide-archive"
                class="font-semibold cursor-pointer py-2 rounded-xl"
                @click="downloadAllAsZip"
              >
                Download ZIP Package ({{ completedCount }})
              </UButton>
            </div>
            <div
              v-else
              class="text-center py-2"
            >
              <p class="text-xs text-neutral-500 italic">
                Upload files or load from history to start
              </p>
            </div>
          </div>
        </div>

        <!-- File List Queue Pane (Solid border, scrollable) -->
        <div
          v-if="filesQueue.length > 0"
          class="space-y-3"
        >
          <h3 class="text-[10px] font-extrabold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase px-1">
            Workspace History ({{ filesQueue.length }})
          </h3>

          <div class="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            <TransitionGroup name="list">
              <div
                v-for="item in filesQueue"
                :key="item.id"
                class="flex items-center gap-3.5 p-3.5 rounded-xl border text-left transition-all duration-300 select-none cursor-pointer"
                :class="[
                  selectedFileId === item.id
                    ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/5 shadow-md shadow-primary-500/5 ring-1 ring-primary-500/30'
                    : 'glass-panel border-neutral-200/60 dark:border-neutral-800/50 hover:border-neutral-350 dark:hover:border-neutral-700/80 hover:shadow-md hover:-translate-y-0.5'
                ]"
                @click="selectedFileId = item.id"
              >
                <!-- Status icon indicator with vibrant halos -->
                <div class="shrink-0">
                  <div 
                    class="w-8.5 h-8.5 rounded-xl flex items-center justify-center border text-neutral-500 transition-colors duration-300"
                    :class="[
                      item.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      item.status === 'processing' ? 'bg-primary-500/15 border-primary-500/25 text-primary-500 pulse-glow' :
                      item.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                      'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400'
                    ]"
                  >
                    <UIcon
                      v-if="item.status === 'processing'"
                      name="i-lucide-loader-2"
                      class="w-4.5 h-4.5 animate-spin"
                    />
                    <UIcon
                      v-else-if="item.status === 'done'"
                      name="i-lucide-check"
                      class="w-4.5 h-4.5"
                    />
                    <UIcon
                      v-else-if="item.status === 'error'"
                      name="i-lucide-alert-circle"
                      class="w-4.5 h-4.5"
                    />
                    <UIcon
                      v-else
                      name="i-lucide-clock"
                      class="w-4.5 h-4.5 opacity-60"
                    />
                  </div>
                </div>

                <!-- Info detail -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {{ item.name }}
                  </p>
                  <p class="text-[10px] text-neutral-500 truncate mt-0.5 font-medium">
                    {{ item.status === 'processing' ? item.progressMsg : item.fileTypeLabel }}
                  </p>
                </div>

                <!-- Actions (Delete or Download) -->
                <div class="flex items-center gap-1.5">
                  <button
                    v-if="item.status === 'done'"
                    class="p-1 rounded-lg text-neutral-400 hover:text-primary-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title="Download Markdown"
                    @click.stop="downloadSingleFile(item)"
                  >
                    <UIcon
                      name="i-lucide-download"
                      class="w-4 h-4"
                    />
                  </button>

                  <button
                    class="p-1 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title="Remove from queue"
                    @click.stop="removeFile(item.id)"
                  >
                    <UIcon
                      name="i-lucide-x"
                      class="w-4 h-4"
                    />
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Markdown split preview / Empty Workspace (Grid Span 8) -->
      <div class="lg:col-span-8 h-full">
        <!-- Render file workspace details -->
        <FilePreview
          v-if="selectedFile"
          :file-name="selectedFile.name"
          :file-size="selectedFile.size"
          :file-type="selectedFile.fileTypeLabel"
          :markdown="selectedFile.markdown"
          :logs="selectedFile.logs"
          :status="selectedFile.status"
          @download="(content) => downloadSingleFile(selectedFile!, content)"
        />

        <!-- Render gorgeous empty workspace layout (Token savings calculator & Open source community card) -->
        <div
          v-else
          class="space-y-8"
        >
          <!-- Empty Workspace Hero -->
          <div
            class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-3xl p-10 md:p-14 text-center flex flex-col items-center justify-center min-h-[300px] shadow-lg relative overflow-hidden"
          >
            <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
            <div class="w-18 h-18 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 mb-6 shadow-md shadow-primary-500/5 animate-float">
              <UIcon
                name="i-lucide-code-2"
                class="w-9 h-9"
              />
            </div>

            <div class="max-w-md space-y-2.5 mb-10">
              <h2 class="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
                Workspace Empty
              </h2>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Drag and drop documents to the upload zone on the left. The optimized Markdown workspace will load instantly. 
                Everything is parsed safely on-device in your browser.
              </p>
            </div>

            <!-- Premium Feature Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl text-left relative z-10">
              <div class="p-5 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-md transition-all duration-300">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-3.5">
                  <UIcon
                    name="i-lucide-shield-check"
                    class="w-5 h-5"
                  />
                </div>
                <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1.5">
                  100% Private
                </h4>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                  No remote backend. Files never leave your local computer.
                </p>
              </div>

              <div class="p-5 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-md transition-all duration-300">
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3.5">
                  <UIcon
                    name="i-lucide-zap"
                    class="w-5 h-5"
                  />
                </div>
                <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1.5">
                  Token Optimizer
                </h4>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                  Strips metadata, formats tables, and cleans hyperlinks to save ~70% context tokens.
                </p>
              </div>

              <div class="p-5 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-md transition-all duration-300">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-3.5">
                  <UIcon
                    name="i-lucide-box"
                    class="w-5 h-5"
                  />
                </div>
                <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1.5">
                  Multiformat
                </h4>
                <p class="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                  Word, PDF, Excel sheets, PPTX, EPUB, HTML, Audio & Zip.
                </p>
              </div>
            </div>
          </div>

          <!-- INTERACTIVE TOKEN COST & SAVINGS CALCULATOR CARD (Ultra-Premium Tech Card) -->
          <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden">
            <div class="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500 shadow-inner">
                <UIcon
                  name="i-lucide-calculator"
                  class="w-5 h-5 text-primary-500"
                />
              </div>
              <div>
                <h3 class="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  Interactive Token & Cost Savings Estimator
                </h3>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Calculate how much money you save on LLM API tokens (GPT/Claude) using MarkDownify's squeezed formatting.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start relative z-10">
              <!-- Left side inputs -->
              <div class="space-y-5 md:col-span-1 border-r border-neutral-200/60 dark:border-neutral-800/40 pr-0 md:pr-6">
                <!-- LLM Model Selection -->
                <div class="space-y-1.5">
                  <label class="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">
                    Target LLM Model
                  </label>
                  <select 
                    v-model="selectedModel"
                    class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/45 transition-all cursor-pointer shadow-inner"
                  >
                    <option 
                      v-for="(val, key) in llmModels" 
                      :key="key" 
                      :value="key"
                    >
                      {{ val.name }}
                    </option>
                  </select>
                </div>

                <!-- Monthly documents count slider -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs font-semibold">
                    <span class="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Monthly Files</span>
                    <span class="font-mono font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded text-[11px]">{{ docsPerMonth }} files</span>
                  </div>
                  <input 
                    v-model.number="docsPerMonth"
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    class="custom-slider w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                </div>

                <!-- Document Size Slider -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs font-semibold">
                    <span class="text-[9px] font-extrabold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Avg. Document Size</span>
                    <span class="font-mono font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded text-[11px]">{{ avgDocSizeKb }} KB</span>
                  </div>
                  <input 
                    v-model.number="avgDocSizeKb"
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    class="custom-slider w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  />
                  <p class="text-[9px] text-neutral-400 dark:text-neutral-500 italic mt-1 font-medium">
                    ~{{ (avgDocSizeKb * 800).toLocaleString() }} source tokens
                  </p>
                </div>
              </div>

              <!-- Right side statistics and cost output columns (solid primary backgrounds) -->
              <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <!-- Token reduction bar graph representation -->
                <div class="border border-neutral-200/65 dark:border-neutral-800/40 rounded-2xl p-5 bg-neutral-50/50 dark:bg-neutral-950/20 flex flex-col justify-between space-y-4 shadow-inner">
                  <span class="text-[9px] font-extrabold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block">
                    Monthly Token Load
                  </span>
                  
                  <div class="space-y-3.5 my-2">
                    <!-- Unoptimized Row -->
                    <div class="space-y-1.5">
                      <div class="flex justify-between text-xs font-mono font-semibold">
                        <span class="text-neutral-500 flex items-center gap-1.5">
                          <span class="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                          Unoptimized
                        </span>
                        <span class="text-neutral-700 dark:text-neutral-300 font-bold">{{ (calculatorStats.originalTokens / 1000000).toFixed(1) }}M <span class="text-[9px] text-neutral-400 font-sans uppercase font-normal">tokens</span></span>
                      </div>
                      <div class="w-full h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full bg-neutral-400 dark:bg-neutral-600 rounded-full w-full" />
                      </div>
                    </div>

                    <!-- Optimized Row -->
                    <div class="space-y-1.5">
                      <div class="flex justify-between text-xs font-mono font-semibold">
                        <span class="text-emerald-500 flex items-center gap-1.5">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          MarkDownify Squeezed
                        </span>
                        <span class="text-emerald-500 font-extrabold">{{ (calculatorStats.optimizedTokens / 1000000).toFixed(1) }}M <span class="text-[9px] text-emerald-400 font-sans uppercase font-normal">tokens</span></span>
                      </div>
                      <div class="w-full h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner relative">
                        <div class="h-full bg-emerald-500 rounded-full w-[30%] shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-550" />
                      </div>
                    </div>
                  </div>

                  <p class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed pt-2.5 border-t border-neutral-200/50 dark:border-neutral-800/40 font-medium">
                    Saves **{{ (calculatorStats.savedTokens / 1000000).toFixed(1) }} Million tokens** from entering LLM context prompts monthly.
                  </p>
                </div>

                <!-- Financial cost savings payout -->
                <div class="border border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-5 bg-emerald-500/5 border-emerald-500/10 flex flex-col justify-between relative overflow-hidden">
                  <div class="absolute -right-8 -bottom-8 text-emerald-500/10 font-bold text-8xl pointer-events-none select-none font-sans">$</div>
                  <span class="text-[9px] font-extrabold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block">
                    Cumulative Cash Saved
                  </span>

                  <div class="py-3 z-10">
                    <p class="text-4xl font-extrabold text-emerald-500 tracking-tight filter drop-shadow-[0_0_15px_rgba(16,185,129,0.15)] leading-none">
                      ${{ Math.round(calculatorStats.monthlySavings).toLocaleString() }}<span class="text-sm font-semibold text-neutral-550 dark:text-neutral-450">/mo</span>
                    </p>
                    <p class="text-xs font-bold text-neutral-700 dark:text-neutral-300 mt-3 flex items-center gap-1.5 leading-none">
                      <UIcon name="i-lucide-trending-up" class="w-4 h-4 text-emerald-500" />
                      <span>${{ Math.round(calculatorStats.annualSavings).toLocaleString() }} saved annually</span>
                    </p>
                  </div>

                  <div class="border-t border-neutral-200/50 dark:border-neutral-800/40 pt-2.5 text-[10px] text-neutral-500 dark:text-neutral-400 leading-normal font-medium z-10">
                    Based on input/output prompt ratios for **{{ llmModels[selectedModel]?.name || 'Claude' }}** API prices.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CLAUDE CLI/DESKTOP SKILL & OPEN SOURCE SPOTLIGHT CARD (Sleek dark layout) -->
          <div class="border border-neutral-800/60 rounded-2xl p-6 md:p-8 bg-neutral-950 text-white space-y-6 shadow-lg shadow-neutral-950/20 relative overflow-hidden select-none">
            <!-- Simulated grid scanlines in the background -->
            <div class="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
            <div class="absolute -right-24 -top-24 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4 relative z-10">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500 text-neutral-950 tracking-wider">
                    NEW SKILL
                  </span>
                  <h3 class="text-base font-extrabold tracking-tight">
                    Integrate local Claude CLI / Desktop Skill
                  </h3>
                </div>
                <p class="text-xs text-neutral-400">
                  Allow your local Claude CLI or Claude Desktop to read complex files using the same Token-Saving parser!
                </p>
              </div>

              <!-- Button pointing to skill info -->
              <UButton
                to="https://github.com/Syf-Almjd/cli-doc2md-mcp"
                target="_blank"
                color="neutral"
                variant="solid"
                icon="i-lucide-git-branch"
                class="font-semibold text-xs py-2 px-3 shrink-0 bg-neutral-900 border border-neutral-800 text-neutral-350 hover:text-white hover:border-neutral-700 transition-all rounded-xl cursor-pointer"
              >
                Explore Claude MCP Skill
              </UButton>
            </div>

            <!-- Features description -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-left relative z-10">
              <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <UIcon name="i-lucide-terminal" class="text-primary-400 w-4.5 h-4.5" />
                  Model Context Protocol
                </h4>
                <p class="text-[11px] text-neutral-400 leading-relaxed font-medium">
                  Utilizes the official MCP standard. Plugs into Claude Desktop, CLI, or any MCP-enabled AI client in seconds.
                </p>
              </div>

              <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <UIcon name="i-lucide-folder" class="text-primary-400 w-4.5 h-4.5" />
                  Self-Contained Sub-Repo
                </h4>
                <p class="text-[11px] text-neutral-400 leading-relaxed font-medium">
                  Located right inside `cli-doc2md-mcp/` directory. Includes Node dependencies, parsers, and auto-configs.
                </p>
              </div>

              <div class="space-y-1.5">
                <h4 class="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <UIcon name="i-lucide-code" class="text-primary-400 w-4.5 h-4.5" />
                  Browserless Extraction
                </h4>
                <p class="text-[11px] text-neutral-400 leading-relaxed font-medium">
                  Automatically converts local `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.epub`, and `.zip` files into optimized Markdown on CLI trigger.
                </p>
              </div>
            </div>

            <!-- Highlight terminal instructions -->
            <div class="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-800/80 text-xs font-mono text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
              <span class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span>Local directory: <span class="text-primary-400 font-bold">./cli-doc2md-mcp</span></span>
              </span>
              <span class="text-[9px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-400 font-bold uppercase tracking-wider self-start sm:self-auto">100% local skill</span>
            </div>
          </div>
        </div>
      </div>
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
  </div>
</template>

<style scoped>
/* Range input track & thumb override */
input[type=range]::-webkit-slider-thumb {
  height: 12px;
  width: 12px;
  border-radius: 99px;
  background: var(--ui-primary);
  cursor: pointer;
  -webkit-appearance: none;
  margin-top: -4px;
}
input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  cursor: pointer;
  border-radius: 4px;
}

/* List transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

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
