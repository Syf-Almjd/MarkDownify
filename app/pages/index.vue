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
const showEstimator = ref(false)

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

// FAQ Section Data for SEO and UX Info
const faqs = [
  {
    question: 'What is MarkDownify?',
    answer: 'MarkDownify is a 100% serverless, private web application that converts documents (PDF, Word, Excel, PowerPoint, HTML, Images, Audio) into clean, standard Markdown. It is optimized to clean up document noise and minimize prompt token usage for AI assistants.'
  },
  {
    question: 'How does MarkDownify save up to 70% of LLM tokens?',
    answer: 'Traditional documents carry massive structural details, styling formats, and metadata bloat that drains LLM contexts. MarkDownify removes this overhead, formats tables and headings cleanly, and processes embedded images via local Web OCR. This results in high-density prompts that save up to 70% on token fees.'
  },
  {
    question: 'Is my document data secure on MarkDownify?',
    answer: 'Yes, absolutely. MarkDownify is completely serverless and runs entirely in your local browser sandbox. It uses Web Assembly (WASM) and local Javascript APIs to process all documents on-device. Your files are never uploaded, tracked, or sent to a server.'
  },
  {
    question: 'How do I run MarkDownify inside Claude Desktop or CLI?',
    answer: 'The repository includes a ready-to-use Model Context Protocol (MCP) server inside the `./cli-doc2md-mcp` folder. You can configure Claude to run this server locally, giving your Claude chats direct, token-optimized access to your local files.'
  }
]
const activeFaqIndex = ref<number | null>(null)
const toggleFaq = (index: number) => {
  activeFaqIndex.value = activeFaqIndex.value === index ? null : index
}
</script>

<template>
  <div class="space-y-10 font-sans w-full">
    <!-- 1. EMPTY STATE LAYOUT (Clean, Centered, Focused) -->
    <div v-if="filesQueue.length === 0" class="max-w-4xl mx-auto space-y-10 py-4">
      <!-- Centered Hero -->
      <div class="text-center space-y-4 max-w-2xl mx-auto">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-neutral-105 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300">
          Open-Source Workspace
        </span>
        <h1 class="text-4xl md:text-5xl font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
          Make your AI Prompts <span class="text-primary-500">Smarter</span>
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          Convert your files into highly optimized, prompt-ready Markdown completely on-device. 
          Save up to <strong class="font-extrabold text-neutral-900 dark:text-white">70% of LLM tokens</strong> for massive API savings and precision prompts.
        </p>
      </div>

      <!-- Large Centered DropZone -->
      <DropZone @files-selected="onFilesSelected" />

      <!-- Estimator & OCR Quick Toggles inside Empty State (Simpler) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- OCR settings -->
        <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div class="space-y-1.5">
            <h3 class="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-lucide-settings" class="w-5 h-5 text-primary-500" />
              On-Device Image OCR
            </h3>
            <p class="text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed">
              Enable local optical character recognition to automatically extract text layer details from nested images inside your documents.
            </p>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
            <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Enable OCR engine:</span>
            <USwitch v-model="ocrEnabled" color="primary" aria-label="Toggle Image OCR" />
          </div>
        </div>

        <!-- Token Estimator Quick Toggle Card -->
        <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div class="space-y-1.5">
            <h3 class="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <UIcon name="i-lucide-calculator" class="w-5 h-5 text-primary-500" />
              Token & Cost Savings Estimator
            </h3>
            <p class="text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed">
              Calculate precisely how many prompt tokens and API expenses you will save each month by cleaning documents using MarkDownify.
            </p>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
            <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Show calculator pane:</span>
            <UButton size="xs" color="neutral" variant="subtle" class="font-semibold cursor-pointer" @click="showEstimator = !showEstimator">
              {{ showEstimator ? 'Hide Calculator' : 'Show Calculator' }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Estimator (Visible when toggled) -->
      <Transition name="expand">
        <div v-show="showEstimator" class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-6 space-y-6">
          <div class="border-b border-neutral-200/60 dark:border-neutral-800/40 pb-4">
            <h3 class="text-sm font-extrabold text-neutral-900 dark:text-white">Savings Calculator</h3>
            <p class="text-xs text-neutral-500 dark:text-neutral-450">Estimate how much money and tokens you save using optimized Markdown formatting.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Selector -->
            <div class="space-y-4">
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block">Target LLM Model</label>
                <select v-model="selectedModel" class="w-full px-3 py-2 rounded-xl border border-neutral-250 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 text-xs font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/45 transition-all cursor-pointer">
                  <option v-for="(val, key) in llmModels" :key="key" :value="key">{{ val.name }}</option>
                </select>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-xs font-semibold">
                  <span class="text-[9px] font-extrabold uppercase tracking-wider">Monthly Files</span>
                  <span class="font-mono text-neutral-900 dark:text-white">{{ docsPerMonth }} files</span>
                </div>
                <input v-model.number="docsPerMonth" type="range" min="10" max="1000" step="10" class="custom-slider w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-500" />
              </div>
              <div class="space-y-2">
                <div class="flex justify-between text-xs font-semibold">
                  <span class="text-[9px] font-extrabold uppercase tracking-wider">Avg Size</span>
                  <span class="font-mono text-neutral-900 dark:text-white">{{ avgDocSizeKb }} KB</span>
                </div>
                <input v-model.number="avgDocSizeKb" type="range" min="10" max="1000" step="10" class="custom-slider w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-500" />
                <p class="text-[9px] text-neutral-400 italic">~{{ (avgDocSizeKb * 800).toLocaleString() }} source tokens per doc</p>
              </div>
            </div>

            <!-- Token Chart -->
            <div class="border border-neutral-200/65 dark:border-neutral-800/45 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-950/20 flex flex-col justify-between space-y-4">
              <span class="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block">Monthly Token Load</span>
              <div class="space-y-3">
                <div class="space-y-1">
                  <div class="flex justify-between text-[11px] font-mono font-semibold">
                    <span class="text-neutral-500">Unoptimized</span>
                    <span class="text-neutral-700 dark:text-neutral-300 font-bold">{{ (calculatorStats.originalTokens / 1000000).toFixed(1) }}M</span>
                  </div>
                  <div class="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div class="h-full bg-neutral-400 dark:bg-neutral-600 w-full" />
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between text-[11px] font-mono font-semibold">
                    <span class="text-emerald-500">MarkDownify</span>
                    <span class="text-emerald-500 font-bold">{{ (calculatorStats.optimizedTokens / 1000000).toFixed(1) }}M</span>
                  </div>
                  <div class="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 w-[30%] transition-all duration-550" />
                  </div>
                </div>
              </div>
              <p class="text-[10px] text-neutral-500 leading-normal border-t border-neutral-200/50 dark:border-neutral-800/40 pt-2">
                Saves **{{ (calculatorStats.savedTokens / 1000000).toFixed(1) }}M tokens** monthly.
              </p>
            </div>

            <!-- Financial Savings -->
            <div class="border border-neutral-200/65 dark:border-neutral-800/45 rounded-xl p-4 bg-emerald-500/5 border-emerald-500/10 flex flex-col justify-between">
              <span class="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block">Cash Saved</span>
              <div class="py-2">
                <p class="text-3xl font-black text-emerald-500 leading-none">
                  ${{ Math.round(calculatorStats.monthlySavings).toLocaleString() }}<span class="text-xs font-semibold text-neutral-550 dark:text-neutral-455">/mo</span>
                </p>
                <p class="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mt-2 flex items-center gap-1">
                  <UIcon name="i-lucide-trending-up" class="w-3.5 h-3.5 text-emerald-500" />
                  <span>${{ Math.round(calculatorStats.annualSavings).toLocaleString() }} saved annually</span>
                </p>
              </div>
              <div class="border-t border-neutral-200/50 dark:border-neutral-800/40 pt-2 text-[9px] text-neutral-400">
                Based on input/output pricing of **{{ llmModels[selectedModel]?.name }}**.
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Claude CLI/Desktop Skill card -->
      <div class="border border-neutral-800/60 rounded-2xl p-6 md:p-8 bg-neutral-950 text-white space-y-6 shadow-lg relative overflow-hidden">
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
          <NuxtLink
            to="https://github.com/Syf-Almjd/cli-doc2md-mcp"
            target="_blank"
            class="font-extrabold text-xs py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-all rounded-xl cursor-pointer flex items-center gap-2"
          >
            <UIcon name="i-lucide-git-branch" class="w-4 h-4 text-emerald-400" />
            Explore Claude MCP Skill
          </NuxtLink>
        </div>

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

        <div class="p-3.5 bg-neutral-900/60 rounded-xl border border-neutral-800/80 text-xs font-mono text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
          <span class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            <span>Local directory: <span class="text-primary-400 font-bold">./cli-doc2md-mcp</span></span>
          </span>
          <span class="text-[9px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-400 font-bold uppercase tracking-wider">100% local skill</span>
        </div>
      </div>

      <!-- Premium Features Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="p-6 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-md transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
            <UIcon name="i-lucide-shield-check" class="w-6 h-6" />
          </div>
          <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2">
            100% Private
          </h4>
          <p class="text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed font-medium">
            No remote backend. Files never leave your local computer. All conversion happens locally in your browser.
          </p>
        </div>

        <div class="p-6 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-amber-500/30 hover:shadow-md transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
            <UIcon name="i-lucide-zap" class="w-6 h-6" />
          </div>
          <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2">
            Token Optimizer
          </h4>
          <p class="text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed font-medium">
            Strips metadata, formats tables, and cleans hyperlinks to save ~70% context tokens for GPT/Claude prompts.
          </p>
        </div>

        <div class="p-6 rounded-2xl bg-white/40 dark:bg-neutral-900/30 border border-neutral-200/50 dark:border-neutral-800/50 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-md transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-4">
            <UIcon name="i-lucide-box" class="w-6 h-6" />
          </div>
          <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2">
            Multiformat
          </h4>
          <p class="text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed font-medium">
            Word documents, PDF, Excel sheets, PowerPoint presentations, EPUB, HTML, Audio transcribing & ZIP.
          </p>
        </div>
      </div>

      <!-- FAQ Accordion Section for SEO and User Guidance -->
      <div class="border-t border-neutral-200/50 dark:border-neutral-800/40 pt-10 mt-6 space-y-6">
        <div class="text-center space-y-2 max-w-xl mx-auto">
          <h2 class="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Learn more about how MarkDownify optimizes prompts and handles your documents.
          </p>
        </div>
        <div class="max-w-3xl mx-auto space-y-3">
          <div
            v-for="(faq, idx) in faqs"
            :key="idx"
            class="glass-panel border border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl overflow-hidden transition-all duration-200"
          >
            <button
              class="w-full py-4 px-5 text-left flex items-center justify-between font-bold text-xs text-neutral-900 dark:text-white hover:bg-neutral-50/50 dark:hover:bg-neutral-900/35 transition-colors cursor-pointer"
              @click="toggleFaq(idx)"
            >
              <span>{{ faq.question }}</span>
              <UIcon
                :name="activeFaqIndex === idx ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="w-4 h-4 text-neutral-450"
              />
            </button>
            <div
              v-show="activeFaqIndex === idx"
              class="px-5 pb-4 text-[11px] text-neutral-550 dark:text-neutral-450 leading-relaxed border-t border-neutral-100 dark:border-neutral-900/40 pt-3"
            >
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. ACTIVE WORKSPACE LAYOUT (2-Column Grid Layout) -->
    <div v-else class="max-w-7xl mx-auto space-y-6">
      <!-- Session summary stats header bar (Vibrant minimal panel) -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <h2 class="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Active Conversion Workspace</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">Upload documents and review on-device parsed Markdown details.</p>
        </div>
        <div class="flex items-center gap-4">
          <!-- Stats badges -->
          <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-xl px-4 py-2 flex items-center gap-4 shadow-sm text-xs">
            <div>
              <span class="text-[9px] font-extrabold text-neutral-450 uppercase block">Total Squeeze</span>
              <span class="font-mono font-bold text-emerald-500 text-sm">-{{ totalSavingsPercent }}%</span>
            </div>
            <div class="h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
            <div>
              <span class="text-[9px] font-extrabold text-neutral-450 uppercase block">Saved Tokens</span>
              <span class="font-mono font-bold text-primary-500 text-sm">{{ totalSavedTokens.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- LEFT COLUMN: Sidebar controls and list (Span 4) -->
        <div class="lg:col-span-4 space-y-6">
          <!-- Compact Drag & Drop -->
          <DropZone compact @files-selected="onFilesSelected" />

          <!-- Workspace controls card -->
          <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/50 rounded-2xl p-5 space-y-4 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-[10px] font-extrabold tracking-wider text-neutral-450 uppercase">Global Controls</h3>
              <button class="text-xs font-semibold text-neutral-500 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer" @click="clearQueue">
                <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
            
            <div class="space-y-3.5 pt-1">
              <!-- OCR Toggle -->
              <div class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/40 pb-2.5">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-neutral-800 dark:text-neutral-200">On-Device OCR</span>
                  <p class="text-[9px] text-neutral-500 leading-normal">Read image text dynamically</p>
                </div>
                <USwitch v-model="ocrEnabled" color="primary" aria-label="Toggle Image OCR" />
              </div>

              <!-- ZIP Downloader -->
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-450">
                <span>Completed:</span>
                <span class="font-mono text-neutral-900 dark:text-white font-bold bg-neutral-100 dark:bg-neutral-850 px-2 py-0.5 rounded">{{ completedCount }} / {{ totalFiles }}</span>
              </div>
              <UButton v-if="completedCount > 0" color="primary" variant="subtle" block icon="i-lucide-archive" class="font-semibold cursor-pointer py-2 rounded-xl" @click="downloadAllAsZip">
                Download ZIP ({{ completedCount }})
              </UButton>
            </div>
          </div>

          <!-- Queue List -->
          <div class="space-y-2.5">
            <h3 class="text-[10px] font-extrabold tracking-wider text-neutral-400 uppercase px-1">Workspace List ({{ filesQueue.length }})</h3>
            <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <TransitionGroup name="list">
                <div
                  v-for="item in filesQueue"
                  :key="item.id"
                  class="flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-300 select-none cursor-pointer"
                  :class="[
                    selectedFileId === item.id
                      ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/5 shadow-md shadow-primary-500/5 ring-1 ring-primary-500/30'
                      : 'glass-panel border-neutral-200/60 dark:border-neutral-800/50 hover:border-neutral-350 dark:hover:border-neutral-700/80 hover:shadow-md hover:-translate-y-0.5'
                  ]"
                  @click="selectedFileId = item.id"
                >
                  <div class="shrink-0">
                    <div 
                      class="w-8 h-8 rounded-lg flex items-center justify-center border text-neutral-500 transition-colors duration-300"
                      :class="[
                        item.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        item.status === 'processing' ? 'bg-primary-500/15 border-primary-500/25 text-primary-500 pulse-glow' :
                        item.status === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                        'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400'
                      ]"
                    >
                      <UIcon v-if="item.status === 'processing'" name="i-lucide-loader-2" class="w-4 h-4 animate-spin" />
                      <UIcon v-else-if="item.status === 'done'" name="i-lucide-check" class="w-4 h-4" />
                      <UIcon v-else-if="item.status === 'error'" name="i-lucide-alert-circle" class="w-4 h-4" />
                      <UIcon v-else name="i-lucide-clock" class="w-4 h-4 opacity-60" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-neutral-900 dark:text-white truncate">{{ item.name }}</p>
                    <p class="text-[9px] text-neutral-550 truncate font-medium mt-0.5">
                      {{ item.status === 'processing' ? item.progressMsg : item.fileTypeLabel }}
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <button v-if="item.status === 'done'" class="p-1 rounded text-neutral-400 hover:text-primary-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer" title="Download Markdown" @click.stop="downloadSingleFile(item)">
                      <UIcon name="i-lucide-download" class="w-3.5 h-3.5" />
                    </button>
                    <button class="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer" title="Remove" @click.stop="removeFile(item.id)">
                      <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>

          <!-- Collapsible Estimator -->
          <div class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-2xl p-4 space-y-4 shadow-sm">
            <div class="flex items-center justify-between cursor-pointer select-none group/est" @click="showEstimator = !showEstimator">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-calculator" class="w-4 h-4 text-primary-500" />
                <span class="text-xs font-bold text-neutral-900 dark:text-white">Savings Estimator</span>
              </div>
              <UIcon :name="showEstimator ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-4 h-4 text-neutral-400" />
            </div>
            <Transition name="expand">
              <div v-show="showEstimator" class="space-y-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/40">
                <div class="space-y-1.5">
                  <label class="text-[9px] font-extrabold text-neutral-450 uppercase tracking-wider block">LLM Model</label>
                  <select v-model="selectedModel" class="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-950/50 text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none">
                    <option v-for="(val, key) in llmModels" :key="key" :value="key">{{ val.name }}</option>
                  </select>
                </div>
                <div class="space-y-1.5">
                  <div class="flex justify-between text-xs">
                    <span class="text-[9px] uppercase tracking-wider font-semibold">Monthly Files</span>
                    <span class="font-mono font-bold">{{ docsPerMonth }}</span>
                  </div>
                  <input v-model.number="docsPerMonth" type="range" min="10" max="1000" step="10" class="custom-slider w-full h-1 rounded-lg appearance-none cursor-pointer accent-primary-500" />
                </div>
                <div class="space-y-1.5">
                  <div class="flex justify-between text-xs">
                    <span class="text-[9px] uppercase tracking-wider font-semibold">Avg size</span>
                    <span class="font-mono font-bold">{{ avgDocSizeKb }} KB</span>
                  </div>
                  <input v-model.number="avgDocSizeKb" type="range" min="10" max="1000" step="10" class="custom-slider w-full h-1 rounded-lg appearance-none cursor-pointer accent-primary-500" />
                </div>
                <div class="p-3 bg-neutral-50 dark:bg-neutral-950/20 border border-neutral-200/50 dark:border-neutral-800/40 rounded-xl space-y-2">
                  <div class="flex justify-between text-[10px] font-semibold">
                    <span class="text-neutral-550">Unoptimized:</span>
                    <span class="text-neutral-800 dark:text-neutral-200 font-bold font-mono">{{ (calculatorStats.originalTokens / 1000000).toFixed(1) }}M tokens</span>
                  </div>
                  <div class="flex justify-between text-[10px] font-semibold">
                    <span class="text-emerald-500">MarkDownify:</span>
                    <span class="text-emerald-500 font-bold font-mono">{{ (calculatorStats.optimizedTokens / 1000000).toFixed(1) }}M tokens</span>
                  </div>
                  <div class="flex justify-between text-[10px] font-semibold border-t border-neutral-200/50 dark:border-neutral-800/40 pt-1.5">
                    <span class="text-neutral-800 dark:text-neutral-200">Cash Saved:</span>
                    <span class="text-emerald-500 font-black font-mono">${{ Math.round(calculatorStats.monthlySavings).toLocaleString() }}/mo</span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- RIGHT COLUMN: Preview pane (Span 8) -->
        <div class="lg:col-span-8 h-full">
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
          <div v-else class="glass-panel border-neutral-200/60 dark:border-neutral-800/40 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <UIcon name="i-lucide-file-text" class="w-12 h-12 text-neutral-450 mb-4 animate-pulse" />
            <h3 class="text-lg font-bold text-neutral-900 dark:text-white mb-2">No file selected</h3>
            <p class="text-xs text-neutral-550 max-w-sm">Select a document from the workspace sidebar list to preview its parsed Markdown result and execution logs.</p>
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

/* Expand/Collapse accordion transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 1200px;
  opacity: 1;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  border-top-color: transparent !important;
}
</style>
