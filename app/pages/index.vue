<script setup lang="ts">
import { ref, computed } from 'vue';
import { convertFile } from '~/utils/converter';
import JSZip from 'jszip';

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  markdown: string;
  fileTypeLabel: string;
  progressMsg: string;
  logs: string[];
}

// State variables
const filesQueue = ref<FileItem[]>([]);
const selectedFileId = ref<string | null>(null);
const isProcessing = ref(false);
const ocrEnabled = ref(false);

// Toast message system
const toastMsg = ref<string | null>(null);
const showToast = (msg: string) => {
  toastMsg.value = msg;
  setTimeout(() => {
    if (toastMsg.value === msg) {
      toastMsg.value = null;
    }
  }, 3000);
};

// Computed properties
const selectedFile = computed(() => {
  return filesQueue.value.find(f => f.id === selectedFileId.value) || null;
});

const totalFiles = computed(() => filesQueue.value.length);
const completedCount = computed(() => filesQueue.value.filter(f => f.status === 'done').length);
const pendingCount = computed(() => filesQueue.value.filter(f => f.status === 'pending').length);
const isQueueProcessing = computed(() => filesQueue.value.some(f => f.status === 'processing'));

// Handle adding files to queue
const onFilesSelected = (files: FileList | File[]) => {
  const newFiles = Array.from(files);
  const itemsToAdd: FileItem[] = [];

  newFiles.forEach((file) => {
    // Avoid exact duplicate names in the current queue for clarity
    if (filesQueue.value.some(f => f.name === file.name)) {
      showToast(`"${file.name}" is already in the list.`);
      return;
    }

    const item: FileItem = {
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      markdown: '',
      fileTypeLabel: 'Pending analysis',
      progressMsg: 'Queued',
      logs: ['File added to conversion queue.']
    };

    itemsToAdd.push(item);
  });

  if (itemsToAdd.length > 0) {
    filesQueue.value.push(...itemsToAdd);
    showToast(`Added ${itemsToAdd.length} file(s) to the queue.`);
    
    // Automatically trigger queue processing if not already running
    if (!isProcessing.value) {
      processQueue();
    }
  }
};

// Process conversion queue sequentially to optimize CPU usage and tab responsiveness
const processQueue = async () => {
  if (isProcessing.value) return;
  
  const nextItem = filesQueue.value.find(f => f.status === 'pending');
  if (!nextItem) {
    isProcessing.value = false;
    return;
  }

  isProcessing.value = true;
  nextItem.status = 'processing';
  nextItem.progressMsg = 'Starting conversion...';
  nextItem.logs.push('Initializing document conversion worker...');

  try {
    const result = await convertFile(nextItem.file, { runOcr: ocrEnabled.value }, (progress) => {
      nextItem.progressMsg = progress;
      nextItem.logs.push(progress);
    });

    nextItem.markdown = result.markdown;
    nextItem.fileTypeLabel = result.fileType;
    nextItem.status = 'done';
    nextItem.progressMsg = 'Completed';
    nextItem.logs.push(`Conversion successful. Output size: ${result.markdown.length} characters.`);

    // Auto-select first completed file to guide UX
    if (!selectedFileId.value) {
      selectedFileId.value = nextItem.id;
    }
  } catch (err: any) {
    console.error(`Error converting ${nextItem.name}:`, err);
    nextItem.status = 'error';
    nextItem.progressMsg = 'Conversion failed';
    nextItem.logs.push(`[ERROR] Conversion aborted: ${err.message || 'Unknown parsing exception'}`);
  }

  isProcessing.value = false;
  // Trigger next item recursively
  processQueue();
};

// Remove single file from queue
const removeFile = (id: string) => {
  const index = filesQueue.value.findIndex(f => f.id === id);
  if (index !== -1) {
    const name = filesQueue.value[index].name;
    filesQueue.value.splice(index, 1);
    
    // Reset selection if removed
    if (selectedFileId.value === id) {
      const nextDone = filesQueue.value.find(f => f.status === 'done');
      selectedFileId.value = nextDone ? nextDone.id : null;
    }
    
    showToast(`Removed "${name}" from queue.`);
  }
};

// Clear entire conversion workspace
const clearQueue = () => {
  filesQueue.value = [];
  selectedFileId.value = null;
  isProcessing.value = false;
  showToast('Conversion workspace cleared.');
};

// Download a single file (.md)
const downloadSingleFile = (item: FileItem) => {
  if (item.status !== 'done') return;
  const baseName = item.name.replace(/\.[^/.]+$/, '');
  const blob = new Blob([item.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded "${baseName}.md"`);
};

// Download all completed conversions as a ZIP archive
const downloadAllAsZip = async () => {
  const completed = filesQueue.value.filter(f => f.status === 'done');
  if (completed.length === 0) return;

  const zip = new JSZip();
  completed.forEach((item) => {
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    zip.file(`${baseName}.md`, item.markdown);
  });

  try {
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'markdownify_archive.zip';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded all conversions as ZIP archive.');
  } catch (err) {
    console.error('Failed to create ZIP package:', err);
    showToast('ZIP generation failed.');
  }
};
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-8 font-sans">
    
    <!-- Hero / Title Section -->
    <div class="text-center md:text-left space-y-2.5">
      <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
        Convert Any File to <span class="text-primary-500 dark:text-primary-400">Markdown</span>
      </h1>
      <p class="text-base text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
        Upload PDFs, Word documents, Excel sheets, PowerPoint decks, HTML, or Images. Convert them into clean, structured Markdown natively in your browser. Complete privacy.
      </p>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- LEFT COLUMN: Uploader & File Queue List (Grid Span 4 on Large Screens) -->
      <div class="lg:col-span-4 space-y-6">
        <!-- Drag & Drop Uploader Panel -->
        <DropZone @files-selected="onFilesSelected" />

        <!-- Converter Controls Panel -->
        <div class="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900/50 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Converter Settings
            </h3>
            
            <button 
              v-if="filesQueue.length > 0"
              @click="clearQueue"
              class="text-xs font-semibold text-neutral-500 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
              Clear Queue
            </button>
          </div>

          <!-- Settings options -->
          <div class="space-y-3">
            <!-- OCR Toggler -->
            <div class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/40 pb-3">
              <div class="space-y-0.5">
                <span class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                  On-Device OCR
                </span>
                <p class="text-xs text-neutral-500">
                  Read readable texts from images (OCR)
                </p>
              </div>
              <USwitch 
                v-model="ocrEnabled" 
                color="primary"
                aria-label="Toggle Image OCR"
              />
            </div>
            
            <!-- Statistics and Bulk Downloads -->
            <div v-if="filesQueue.length > 0" class="pt-1 space-y-3">
              <!-- Progress Stats -->
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                <span>Conversions Completed:</span>
                <span class="text-neutral-900 dark:text-white">{{ completedCount }} / {{ totalFiles }}</span>
              </div>

              <!-- ZIP Downloader -->
              <UButton
                v-if="completedCount > 0"
                @click="downloadAllAsZip"
                color="primary"
                variant="subtle"
                block
                icon="i-lucide-archive"
                class="font-semibold cursor-pointer"
              >
                Download All as ZIP ({{ completedCount }})
              </UButton>
            </div>
            <div v-else class="text-center py-2">
              <p class="text-xs text-neutral-500 italic">
                Upload a file to unlock settings
              </p>
            </div>
          </div>
        </div>

        <!-- File List Queue Pane -->
        <div v-if="filesQueue.length > 0" class="space-y-3">
          <h3 class="text-xs font-bold tracking-wider text-neutral-400 uppercase px-1">
            Conversion Queue ({{ filesQueue.length }})
          </h3>

          <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <TransitionGroup name="list">
              <div
                v-for="item in filesQueue"
                :key="item.id"
                @click="item.status === 'done' ? selectedFileId = item.id : null"
                class="flex items-center gap-3 p-3 rounded-lg border text-left transition-all select-none"
                :class="[
                  selectedFileId === item.id 
                    ? 'border-primary-500 bg-primary-50/5 dark:bg-primary-950/5' 
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/30 hover:border-neutral-300 dark:hover:border-neutral-700',
                  item.status === 'done' ? 'cursor-pointer' : 'cursor-default'
                ]"
              >
                <!-- Type Badge Status Indicator -->
                <div class="shrink-0 relative">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                    <!-- Icon based on conversion status -->
                    <UIcon 
                      v-if="item.status === 'processing'" 
                      name="i-lucide-loader-2" 
                      class="w-4.5 h-4.5 animate-spin text-primary-500" 
                    />
                    <UIcon 
                      v-else-if="item.status === 'done'" 
                      name="i-lucide-check" 
                      class="w-4.5 h-4.5 text-emerald-500" 
                    />
                    <UIcon 
                      v-else-if="item.status === 'error'" 
                      name="i-lucide-alert-circle" 
                      class="w-4.5 h-4.5 text-red-500" 
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
                  <p class="text-xs text-neutral-500 truncate mt-0.5">
                    {{ item.status === 'processing' ? item.progressMsg : item.fileTypeLabel }}
                  </p>
                </div>

                <!-- Actions (Delete or Download) -->
                <div class="flex items-center gap-1.5">
                  <!-- Download icon if finished -->
                  <button
                    v-if="item.status === 'done'"
                    @click.stop="downloadSingleFile(item)"
                    class="p-1 rounded text-neutral-400 hover:text-primary-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title="Download Markdown"
                  >
                    <UIcon name="i-lucide-download" class="w-4 h-4" />
                  </button>
                  
                  <!-- Cancel / Delete button -->
                  <button
                    @click.stop="removeFile(item.id)"
                    class="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title="Remove from queue"
                  >
                    <UIcon name="i-lucide-x" class="w-4 h-4" />
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
          @download="downloadSingleFile(selectedFile)"
        />

        <!-- Render beautiful empty workspace card details -->
        <div 
          v-else 
          class="border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 md:p-12 bg-white dark:bg-neutral-900/50 shadow-sm text-center flex flex-col items-center justify-center min-h-[400px] lg:min-h-[500px]"
        >
          <div class="w-16 h-16 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-400 mb-6 shadow-sm">
            <UIcon name="i-lucide-code-2" class="w-8 h-8 text-primary-500 dark:text-primary-400" />
          </div>

          <div class="max-w-md space-y-2 mb-8">
            <h2 class="text-xl font-bold text-neutral-900 dark:text-white">
              No Document Selected
            </h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              Drag and drop any document to the upload zone on the left. The markdown workspace will instantly display and load your rendered text preview once converted!
            </p>
          </div>

          <!-- Feature items highlighting private in-browser capability -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl text-left">
            <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/80">
              <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-emerald-500 mb-2" />
              <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">
                Private & Secure
              </h4>
              <p class="text-xs text-neutral-500">
                Processed entirely on-device in your browser. Files never touch any server.
              </p>
            </div>

            <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/80">
              <UIcon name="i-lucide-zap" class="w-5 h-5 text-yellow-500 mb-2" />
              <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">
                Instant Parsers
              </h4>
              <p class="text-xs text-neutral-500">
                Word parsing, PDF layers, sheet arrays, slide folders parsed immediately.
              </p>
            </div>

            <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/50 dark:border-neutral-800/80">
              <UIcon name="i-lucide-eye" class="w-5 h-5 text-blue-500 mb-2" />
              <h4 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-1">
                Split Preview
              </h4>
              <p class="text-xs text-neutral-500">
                Check rendered formatting alongside structural raw markdown in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Interactive Toast System (Bottom right, gradient-free notification) -->
    <Transition name="fade">
      <div 
        v-if="toastMsg" 
        class="fixed bottom-6 right-6 px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-900 text-white dark:border-neutral-200 dark:bg-white dark:text-neutral-900 shadow-lg text-sm font-semibold flex items-center gap-2 z-50 transition-all duration-300"
      >
        <UIcon name="i-lucide-info" class="w-4 h-4 text-primary-500" />
        {{ toastMsg }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* List transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-15px);
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
