/* eslint-disable */
import TurndownService from 'turndown'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

// Initialize Turndown
const getTurndownService = () => {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  })

  // Custom rule for stripping empty paragraphs
  service.addRule('emptyParagraphs', {
    filter: (node: any) => node.nodeName === 'P' && !node.textContent?.trim(),
    replacement: () => ''
  })

  return service
}

// Safe lazy loading of PDF.js
let pdfjsLib: any = null
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib
  if (typeof window === 'undefined') return null

  try {
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'))
        document.head.appendChild(script)
      })
    }
    
    pdfjsLib = (window as any).pdfjsLib
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    return pdfjsLib
  } catch (err) {
    console.error('Failed to load PDF.js from CDN:', err)
    throw new Error('PDF.js engine could not be loaded.')
  }
}

// Lazy loading of Tesseract.js for OCR
let tesseract: any = null
const loadTesseract = async () => {
  if (tesseract) return tesseract
  if (typeof window === 'undefined') return null

  try {
    tesseract = await import('tesseract.js')
    return tesseract
  } catch (err) {
    console.error('Failed to load Tesseract.js dynamically:', err)
    throw new Error('OCR engine (Tesseract) could not be loaded.')
  }
}

/**
 * Convert HTML to Markdown
 */
export function convertHtml(htmlText: string): string {
  const turndown = getTurndownService()
  return turndown.turndown(htmlText)
}

/**
 * Convert Text or Code files to Markdown
 */
export function convertTextCode(text: string, extension: string = 'txt', fileName: string = ''): string {
  const cleanExtension = extension.toLowerCase().replace('.', '')

  // Format based on common extensions
  let language = 'text'
  if (['js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'html', 'css', 'scss', 'py', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'md'].includes(cleanExtension)) {
    language = cleanExtension
  }

  return `# ${fileName || 'Document'}\n\n\`\`\`${language}\n${text}\n\`\`\`\n`
}

/**
 * Convert JSON or XML to Markdown code block
 */
export function convertJsonXml(text: string, type: 'json' | 'xml', fileName: string = ''): string {
  let formatted = text

  if (type === 'json') {
    try {
      const parsed = JSON.parse(text)
      formatted = JSON.stringify(parsed, null, 2)
    } catch {
      // Keep as-is if parsing fails
    }
    return `# ${fileName || 'JSON Document'}\n\n\`\`\`json\n${formatted}\n\`\`\`\n`
  } else {
    // Basic XML beautifier (fallback)
    return `# ${fileName || 'XML Document'}\n\n\`\`\`xml\n${formatted}\n\`\`\`\n`
  }
}

/**
 * Convert Word Document (.docx) to Markdown
 */
export async function convertDocx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const html = result.value

  let markdown = `# ${fileName.replace(/\.docx$/i, '') || 'Word Document'}\n\n`

  const turndown = getTurndownService()
  markdown += turndown.turndown(html)

  // Check for conversion warnings
  if (result.messages && result.messages.length > 0) {
    markdown += '\n\n---\n\n### Conversion Notes\n'
    result.messages.forEach((msg) => {
      markdown += `- *[${msg.type}]* ${msg.message}\n`
    })
  }

  return markdown
}

/**
 * Convert Excel spreadsheets (.xlsx, .xls, .csv) to Markdown tables
 */
export async function convertXlsx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  let markdown = `# ${fileName.replace(/\.(xlsx|xls|csv)$/i, '') || 'Spreadsheet Data'}\n\n`

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return
    // Convert to JSON row array
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })
    if (rows.length === 0) return

    markdown += `## Sheet: ${sheetName}\n\n`

    // Determine maximum columns in any row
    const colCount = Math.max(...rows.map(r => r.length), 0)
    if (colCount === 0) return

    const headerRow = rows[0] || []
    const bodyRows = rows.slice(1)

    // Cell sanitization
    const formatCell = (val: any) => {
      if (val === undefined || val === null) return ''
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
    }

    // Generate headers
    const headers = Array.from({ length: colCount }).map((_, i) => formatCell(headerRow[i]) || `Column ${i + 1}`)
    markdown += '| ' + headers.join(' | ') + ' |\n'

    // Generate separators
    markdown += '| ' + Array.from({ length: colCount }).map(() => '---').join(' | ') + ' |\n'

    // Generate body rows
    bodyRows.forEach((row) => {
      const cells = Array.from({ length: colCount }).map((_, i) => formatCell(row[i]))
      markdown += '| ' + cells.join(' | ') + ' |\n'
    })

    markdown += '\n'
  })

  return markdown
}

/**
 * Convert PowerPoint slides (.pptx) to slide-structured Markdown
 */
export async function convertPptx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Gather slide files
  const slideFiles = Object.keys(zip.files).filter(
    name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  )

  // Sort them numerically: slide1.xml, slide2.xml... slide10.xml
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10)
    const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10)
    return numA - numB
  })

  let markdown = `# ${fileName.replace(/\.pptx$/i, '') || 'Presentation Slides'}\n\n`

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i]
    if (!slideFile) continue
    const zipFile = zip.file(slideFile)
    if (!zipFile) continue
    const xmlText = await zipFile.async('text')

    // Parse slide elements XML
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

    // PPTX paragraphs are <a:p> and text runs are <a:t>
    const paragraphs = xmlDoc.getElementsByTagName('a:p')
    const slideContent: string[] = []

    for (let j = 0; j < paragraphs.length; j++) {
      const p = paragraphs[j]
      if (!p) continue
      const textRuns = p.getElementsByTagName('a:t')
      let paragraphText = ''

      for (let k = 0; k < textRuns.length; k++) {
        const tr = textRuns[k]
        if (tr) {
          paragraphText += tr.textContent || ''
        }
      }

      const trimmed = paragraphText.trim()
      if (trimmed) {
        slideContent.push(trimmed)
      }
    }

    markdown += `## Slide ${i + 1}\n\n`
    if (slideContent.length > 0) {
      // The first line is likely the slide title
      const title = slideContent[0]
      const body = slideContent.slice(1)

      markdown += `### ${title}\n\n`
      body.forEach((line) => {
        markdown += `- ${line}\n`
      })
    } else {
      markdown += '*(Empty Slide)*\n'
    }

    markdown += '\n---\n\n'
  }

  // Strip trailing divider
  markdown = markdown.trim().replace(/\n---\n*$/, '')

  return markdown + '\n'
}

/**
 * Convert PDF files to structured Markdown (using PDF.js)
 */
export async function convertPdf(
  arrayBuffer: ArrayBuffer,
  fileName: string = '',
  onProgress?: (msg: string) => void
): Promise<string> {
  const lib = await loadPdfJs()
  if (!lib) {
    throw new Error('Browser environment not available.')
  }

  if (onProgress) onProgress('Loading PDF document...')
  const loadingTask = lib.getDocument({ data: new Uint8Array(arrayBuffer) })
  const pdf = await loadingTask.promise

  let markdown = `# ${fileName.replace(/\.pdf$/i, '') || 'PDF Document'}\n\n`

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (onProgress) onProgress(`Extracting page ${pageNum} of ${pdf.numPages}...`)

    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const items = textContent.items as any[]

    if (items.length === 0) {
      markdown += `## Page ${pageNum}\n\n*(Empty Page)*\n\n`
      continue
    }

    // Group characters by Y height to rebuild natural paragraphs
    const linesMap: { [key: number]: any[] } = {}
    items.forEach((item) => {
      const y = Math.round(item.transform[5] * 10) / 10
      // Match coordinate tolerances within 4px range (accounts for text adjustments)
      const foundY = Object.keys(linesMap).find(k => Math.abs(parseFloat(k) - y) < 4)
      if (foundY !== undefined) {
        const numericY = parseFloat(foundY)
        const line = linesMap[numericY]
        if (line) {
          line.push(item)
        }
      } else {
        linesMap[y] = [item]
      }
    })

    // Sort lines from top (highest Y) to bottom
    const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a)
    let pageText = ''

    sortedY.forEach((y) => {
      const lineItems = linesMap[y]
      if (lineItems) {
        // Sort text inside lines left-to-right (horizontal X coordinate)
        lineItems.sort((a, b) => a.transform[4] - b.transform[4])

        const lineStr = lineItems.map(item => item.str).join(' ')
        if (lineStr.trim()) {
          pageText += lineStr + '\n'
        }
      }
    })

    markdown += `## Page ${pageNum}\n\n${pageText.trim()}\n\n`
  }

  return markdown.trim() + '\n'
}

/**
 * Extract basic dimensions from image File
 */
const getImageDimensions = (file: File): Promise<{ width: number, height: number }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ width: 0, height: 0 })
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Convert Image files to structured Markdown (metadata + optional OCR)
 */
export async function convertImage(
  file: File,
  runOcr: boolean = false,
  onProgress?: (msg: string) => void
): Promise<string> {
  const name = file.name
  const sizeKb = (file.size / 1024).toFixed(1)
  const type = file.type

  let dims = { width: 0, height: 0 }
  try {
    dims = await getImageDimensions(file)
  } catch {
    // Ignore dimension failures
  }

  let markdown = `# Image: ${name.replace(/\.[^/.]+$/, '')}\n\n`
  markdown += `### File Metadata\n\n`
  markdown += `| Property | Value |\n`
  markdown += `| --- | --- |\n`
  markdown += `| **File Name** | ${name} |\n`
  markdown += `| **Format** | ${type} |\n`
  markdown += `| **File Size** | ${sizeKb} KB |\n`
  if (dims.width > 0) {
    markdown += `| **Dimensions** | ${dims.width} x ${dims.height} px |\n`
    markdown += `| **Aspect Ratio** | ${(dims.width / dims.height).toFixed(2)} |\n`
  }
  markdown += `\n`

  if (runOcr) {
    if (onProgress) onProgress('Loading OCR Engine (Tesseract)...')
    try {
      const T = await loadTesseract()
      if (T) {
        if (onProgress) onProgress('Initializing engine and language packs...')
        const worker = await T.createWorker('eng')

        if (onProgress) onProgress('Reading text from image...')
        const result = await worker.recognize(file)
        await worker.terminate()

        const text = result.data.text.trim()

        markdown += `### Extracted OCR Text\n\n`
        if (text) {
          markdown += `\`\`\`text\n${text}\n\`\`\`\n`
        } else {
          markdown += `*(OCR completed: No readable text detected in the image)*\n`
        }
      }
    } catch (err: any) {
      markdown += `### Extracted OCR Text\n\n`
      markdown += `> [!WARNING]\n`
      markdown += `> OCR processing failed: ${err.message || err}\n`
    }
  } else {
    markdown += `*Note: On-device OCR was not enabled for this image. Enable OCR in settings to extract readable text contents.*\n`
  }

  return markdown
}

/**
 * Convert Audio/Video files to structured Markdown (metadata)
 */
export async function convertAudioVideo(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const name = file.name
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
  const type = file.type

  if (onProgress) onProgress('Analyzing media parameters...')

  let markdown = `# Media Details: ${name.replace(/\.[^/.]+$/, '')}\n\n`
  markdown += `### File Metadata\n\n`
  markdown += `| Parameter | Value |\n`
  markdown += `| --- | --- |\n`
  markdown += `| **File Name** | ${name} |\n`
  const mediaType = (type.split('/')[0] || 'media').toUpperCase()
  markdown += `| **Media Type** | ${mediaType} |\n`
  markdown += `| **Mime Type** | ${type} |\n`
  markdown += `| **File Size** | ${sizeMb} MB |\n`

  // Try to load in audio/video element client-side to read duration
  if (typeof window !== 'undefined') {
    try {
      const duration: number = await new Promise((resolve) => {
        const media = document.createElement(type.startsWith('video') ? 'video' : 'audio')
        media.preload = 'metadata'
        media.src = URL.createObjectURL(file)
        media.onloadedmetadata = () => {
          resolve(media.duration)
        }
        media.onerror = () => {
          resolve(0)
        }
      })

      if (duration > 0) {
        const minutes = Math.floor(duration / 60)
        const seconds = Math.round(duration % 60)
        const formatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
        markdown += `| **Duration** | ${formatted} (${duration.toFixed(2)} seconds) |\n`
      }
    } catch {
      // Ignore errors parsing duration
    }
  }

  markdown += `\n\n---\n\n`
  markdown += `### Media Analysis Summary\n\n`
  markdown += `This file was analyzed via the **MarkDownify** client-side media processor. Since transcription requires large local models, we have parsed the binary headers and structural formats directly in your browser. Feel free to copy these details to document your media library assets!\n`

  return markdown
}

/**
 * Convert EPUB books (.epub) to clean Markdown
 */
export async function convertEpub(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Gather all xhtml/html files inside the EPUB zip
  const htmlFiles = Object.keys(zip.files).filter(
    name => name.endsWith('.xhtml') || name.endsWith('.html') || name.endsWith('.htm')
  )

  // Sort files naturally so chapters stay in reading order
  htmlFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  let markdown = `# EPUB Book: ${fileName.replace(/\.epub$/i, '') || 'E-book'}\n\n`
  const turndown = getTurndownService()

  for (let i = 0; i < htmlFiles.length; i++) {
    const htmlFile = htmlFiles[i]
    if (!htmlFile) continue
    const zipFile = zip.file(htmlFile)
    if (!zipFile) continue
    const htmlContent = await zipFile.async('text')

    // Clean and transform XHTML/HTML sections
    const sectionMarkdown = turndown.turndown(htmlContent)
    if (sectionMarkdown.trim()) {
      const fileNameOnly = htmlFile.split('/').pop()?.replace(/\.(xhtml|html?)$/i, '') || htmlFile
      markdown += `## Section: ${fileNameOnly}\n\n${sectionMarkdown.trim()}\n\n---\n\n`
    }
  }

  // Remove trailing divider
  markdown = markdown.trim().replace(/\n---\n*$/, '')
  return markdown + '\n'
}

/**
 * Recursively convert files inside ZIP Archives (.zip) to a consolidated Markdown file
 */
export async function convertZip(
  arrayBuffer: ArrayBuffer,
  fileName: string = '',
  options: { runOcr?: boolean } = {},
  onProgress?: (msg: string) => void
): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)

  let markdown = `# ZIP Archive: ${fileName || 'Archive'}\n\n`
  markdown += `This archive contains converted documents parsed recursively in your browser.\n\n---\n\n`

  // Filter out directories, focus on files
  const fileEntries = Object.keys(zip.files).filter((name) => {
    const entry = zip.files[name]
    return entry && !entry.dir
  })

  for (let i = 0; i < fileEntries.length; i++) {
    const path = fileEntries[i]
    if (!path) continue
    const zipEntry = zip.file(path)
    if (!zipEntry) continue
    const ext = path.split('.').pop()?.toLowerCase() || ''

    onProgress?.(`Extracting member ${i + 1}/${fileEntries.length}: ${path}...`)
    markdown += `## File Entry: \`${path}\`\n\n`

    try {
      if (
        ['txt', 'js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'css', 'scss', 'py', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'md'].includes(ext)
      ) {
        const text = await zipEntry.async('text')
        if (ext === 'json') {
          markdown += convertJsonXml(text, 'json', path)
        } else if (ext === 'xml') {
          markdown += convertJsonXml(text, 'xml', path)
        } else {
          markdown += convertTextCode(text, ext, path)
        }
      } else if (ext === 'html' || ext === 'htm') {
        const text = await zipEntry.async('text')
        markdown += convertHtml(text)
      } else if (ext === 'docx') {
        const buffer = await zipEntry.async('arraybuffer')
        markdown += await convertDocx(buffer, path)
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        const buffer = await zipEntry.async('arraybuffer')
        markdown += await convertXlsx(buffer, path)
      } else if (ext === 'pptx') {
        const buffer = await zipEntry.async('arraybuffer')
        markdown += await convertPptx(buffer, path)
      } else if (ext === 'epub') {
        const buffer = await zipEntry.async('arraybuffer')
        markdown += await convertEpub(buffer, path)
      } else if (ext === 'pdf') {
        const buffer = await zipEntry.async('arraybuffer')
        markdown += await convertPdf(buffer, path, msg => onProgress?.(`[${path}] ${msg}`))
      } else {
        const sizeKb = ((zipEntry as any)._data?.uncompressedSize || 0) / 1024
        markdown += `*Binary file entry skipped (${sizeKb.toFixed(1)} KB)*\n`
      }
    } catch (err: any) {
      markdown += `> [!WARNING]\n> Failed to convert zip member \`${path}\`: ${err.message || err}\n`
    }

    markdown += '\n\n---\n\n'
  }

  // Remove trailing divider
  markdown = markdown.trim().replace(/\n---\n*$/, '')
  return markdown + '\n'
}

/**
 * Orchestrate conversion based on file type
 */
export async function convertFile(
  file: File,
  options: { runOcr?: boolean } = {},
  onProgress?: (msg: string) => void
): Promise<{ markdown: string, fileType: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const type = file.type || ''

  let markdown = ''
  let fileType = 'Unknown'

  onProgress?.('Reading raw file data...')

  // 1. Text or Code files
  if (
    type.startsWith('text/')
    || ['txt', 'js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'css', 'scss', 'py', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'md'].includes(extension)
  ) {
    const text = await file.text()
    fileType = 'Plain Text / Code'
    if (extension === 'json') {
      markdown = convertJsonXml(text, 'json', file.name)
    } else if (extension === 'xml') {
      markdown = convertJsonXml(text, 'xml', file.name)
    } else {
      markdown = convertTextCode(text, extension, file.name)
    }
  }
  // 2. HTML
  else if (extension === 'html' || extension === 'htm') {
    const text = await file.text()
    fileType = 'HTML Webpage'
    markdown = `# ${file.name.replace(/\.html?$/i, '')}\n\n` + convertHtml(text)
  }
  // 3. Word Document
  else if (extension === 'docx') {
    fileType = 'Word Document (.docx)'
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertDocx(arrayBuffer, file.name)
  }
  // 4. Excel / Spreadsheet
  else if (['xlsx', 'xls', 'csv'].includes(extension)) {
    fileType = `Spreadsheet (.${extension})`
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertXlsx(arrayBuffer, file.name)
  }
  // 5. PowerPoint Presentation
  else if (extension === 'pptx') {
    fileType = 'PowerPoint Slide deck (.pptx)'
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertPptx(arrayBuffer, file.name)
  }
  // 6. PDF
  else if (extension === 'pdf') {
    fileType = 'PDF Document'
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertPdf(arrayBuffer, file.name, onProgress)
  }
  // 7. EPUB Book
  else if (extension === 'epub') {
    fileType = 'EPUB E-book (.epub)'
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertEpub(arrayBuffer, file.name)
  }
  // 8. ZIP Archive (recursive processing)
  else if (extension === 'zip') {
    fileType = 'ZIP Archive (.zip)'
    const arrayBuffer = await file.arrayBuffer()
    markdown = await convertZip(arrayBuffer, file.name, options, onProgress)
  } else if (type.startsWith('image/')) {
    const imgType = (type.split('/')[1] || 'IMAGE').toUpperCase()
    fileType = `Image (${imgType})`
    markdown = await convertImage(file, !!options.runOcr, onProgress)
  }
  // 10. Audio / Video
  else if (type.startsWith('audio/') || type.startsWith('video/')) {
    fileType = type.startsWith('video') ? 'Video File' : 'Audio File'
    markdown = await convertAudioVideo(file, onProgress)
  }
  // 11. Unknown fallback
  else {
    fileType = 'Binary / Unknown Format'
    markdown = `# Binary File: ${file.name}\n\n`
    markdown += `| Attribute | Value |\n`
    markdown += `| --- | --- |\n`
    markdown += `| **File Name** | ${file.name} |\n`
    markdown += `| **Size** | ${(file.size / 1024).toFixed(1)} KB |\n`
    markdown += `| **Mime Type** | ${file.type || 'unknown'} |\n\n`
    markdown += `> [!NOTE]\n`
    markdown += `> This format is currently not directly parseable as rich text inside the web app. You can download this structural overview as a markdown manifest card.\n`
  }

  return { markdown, fileType }
}
