import TurndownService from 'turndown';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Initialize Turndown
const getTurndownService = () => {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  });
  
  // Custom rule for stripping empty paragraphs
  service.addRule('emptyParagraphs', {
    filter: (node) => node.nodeName === 'P' && !node.textContent?.trim(),
    replacement: () => ''
  });

  return service;
};

// Safe lazy loading of PDF.js
let pdfjsLib: any = null;
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  if (typeof window === 'undefined') return null;
  
  try {
    pdfjsLib = await import('pdfjs-dist');
    // Set up CDN worker
    const version = pdfjsLib.version || '3.11.174';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    return pdfjsLib;
  } catch (err) {
    console.error('Failed to load PDF.js dynamically:', err);
    throw new Error('PDF.js engine could not be loaded.');
  }
};

// Lazy loading of Tesseract.js for OCR
let tesseract: any = null;
const loadTesseract = async () => {
  if (tesseract) return tesseract;
  if (typeof window === 'undefined') return null;
  
  try {
    tesseract = await import('tesseract.js');
    return tesseract;
  } catch (err) {
    console.error('Failed to load Tesseract.js dynamically:', err);
    throw new Error('OCR engine (Tesseract) could not be loaded.');
  }
};

/**
 * Convert HTML to Markdown
 */
export function convertHtml(htmlText: string): string {
  const turndown = getTurndownService();
  return turndown.turndown(htmlText);
}

/**
 * Convert Text or Code files to Markdown
 */
export function convertTextCode(text: string, extension: string = 'txt', fileName: string = ''): string {
  const cleanExtension = extension.toLowerCase().replace('.', '');
  
  // Format based on common extensions
  let language = 'text';
  if (['js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'html', 'css', 'scss', 'py', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'md'].includes(cleanExtension)) {
    language = cleanExtension;
  }
  
  return `# ${fileName || 'Document'}\n\n\`\`\`${language}\n${text}\n\`\`\`\n`;
}

/**
 * Convert JSON or XML to Markdown code block
 */
export function convertJsonXml(text: string, type: 'json' | 'xml', fileName: string = ''): string {
  let formatted = text;
  
  if (type === 'json') {
    try {
      const parsed = JSON.parse(text);
      formatted = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep as-is if parsing fails
    }
    return `# ${fileName || 'JSON Document'}\n\n\`\`\`json\n${formatted}\n\`\`\`\n`;
  } else {
    // Basic XML beautifier (fallback)
    return `# ${fileName || 'XML Document'}\n\n\`\`\`xml\n${formatted}\n\`\`\`\n`;
  }
}

/**
 * Convert Word Document (.docx) to Markdown
 */
export async function convertDocx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;
  
  let markdown = `# ${fileName.replace(/\.docx$/i, '') || 'Word Document'}\n\n`;
  
  const turndown = getTurndownService();
  markdown += turndown.turndown(html);
  
  // Check for conversion warnings
  if (result.messages && result.messages.length > 0) {
    markdown += '\n\n---\n\n### Conversion Notes\n';
    result.messages.forEach((msg) => {
      markdown += `- *[${msg.type}]* ${msg.message}\n`;
    });
  }
  
  return markdown;
}

/**
 * Convert Excel spreadsheets (.xlsx, .xls, .csv) to Markdown tables
 */
export async function convertXlsx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let markdown = `# ${fileName.replace(/\.(xlsx|xls|csv)$/i, '') || 'Spreadsheet Data'}\n\n`;
  
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON row array
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    if (rows.length === 0) return;
    
    markdown += `## Sheet: ${sheetName}\n\n`;
    
    // Determine maximum columns in any row
    const colCount = Math.max(...rows.map(r => r.length), 0);
    if (colCount === 0) return;
    
    const headerRow = rows[0] || [];
    const bodyRows = rows.slice(1);
    
    // Cell sanitization
    const formatCell = (val: any) => {
      if (val === undefined || val === null) return '';
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    };
    
    // Generate headers
    const headers = Array.from({ length: colCount }).map((_, i) => formatCell(headerRow[i]) || `Column ${i + 1}`);
    markdown += '| ' + headers.join(' | ') + ' |\n';
    
    // Generate separators
    markdown += '| ' + Array.from({ length: colCount }).map(() => '---').join(' | ') + ' |\n';
    
    // Generate body rows
    bodyRows.forEach((row) => {
      const cells = Array.from({ length: colCount }).map((_, i) => formatCell(row[i]));
      markdown += '| ' + cells.join(' | ') + ' |\n';
    });
    
    markdown += '\n';
  });
  
  return markdown;
}

/**
 * Convert PowerPoint slides (.pptx) to slide-structured Markdown
 */
export async function convertPptx(arrayBuffer: ArrayBuffer, fileName: string = ''): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Gather slide files
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );
  
  // Sort them numerically: slide1.xml, slide2.xml... slide10.xml
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?. [0] || '0', 10);
    const numB = parseInt(b.match(/\d+/)?. [0] || '0', 10);
    return numA - numB;
  });
  
  let markdown = `# ${fileName.replace(/\.pptx$/i, '') || 'Presentation Slides'}\n\n`;
  
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    const xmlText = await zip.files[slideFile].async('text');
    
    // Parse slide elements XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // PPTX paragraphs are <a:p> and text runs are <a:t>
    const paragraphs = xmlDoc.getElementsByTagName('a:p');
    let slideContent: string[] = [];
    
    for (let j = 0; j < paragraphs.length; j++) {
      const p = paragraphs[j];
      const textRuns = p.getElementsByTagName('a:t');
      let paragraphText = '';
      
      for (let k = 0; k < textRuns.length; k++) {
        paragraphText += textRuns[k].textContent || '';
      }
      
      const trimmed = paragraphText.trim();
      if (trimmed) {
        slideContent.push(trimmed);
      }
    }
    
    markdown += `## Slide ${i + 1}\n\n`;
    if (slideContent.length > 0) {
      // The first line is likely the slide title
      const title = slideContent[0];
      const body = slideContent.slice(1);
      
      markdown += `### ${title}\n\n`;
      body.forEach((line) => {
        markdown += `- ${line}\n`;
      });
    } else {
      markdown += '*(Empty Slide)*\n';
    }
    
    markdown += '\n---\n\n';
  }
  
  // Strip trailing divider
  markdown = markdown.trim().replace(/\n---\n*$/, '');
  
  return markdown + '\n';
}

/**
 * Convert PDF files to structured Markdown (using PDF.js)
 */
export async function convertPdf(
  arrayBuffer: ArrayBuffer, 
  fileName: string = '', 
  onProgress?: (msg: string) => void
): Promise<string> {
  const lib = await loadPdfJs();
  if (!lib) {
    throw new Error('Browser environment not available.');
  }
  
  if (onProgress) onProgress('Loading PDF document...');
  const loadingTask = lib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  
  let markdown = `# ${fileName.replace(/\.pdf$/i, '') || 'PDF Document'}\n\n`;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    if (onProgress) onProgress(`Extracting page ${pageNum} of ${pdf.numPages}...`);
    
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    if (items.length === 0) {
      markdown += `## Page ${pageNum}\n\n*(Empty Page)*\n\n`;
      continue;
    }
    
    // Group characters by Y height to rebuild natural paragraphs
    const linesMap: { [key: number]: any[] } = {};
    items.forEach((item) => {
      const y = Math.round(item.transform[5] * 10) / 10;
      // Match coordinate tolerances within 4px range (accounts for text adjustments)
      const foundY = Object.keys(linesMap).find(k => Math.abs(parseFloat(k) - y) < 4);
      if (foundY) {
        linesMap[parseFloat(foundY)].push(item);
      } else {
        linesMap[y] = [item];
      }
    });
    
    // Sort lines from top (highest Y) to bottom
    const sortedY = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
    let pageText = '';
    
    sortedY.forEach((y) => {
      const lineItems = linesMap[y];
      // Sort text inside lines left-to-right (horizontal X coordinate)
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      
      const lineStr = lineItems.map((item) => item.str).join(' ');
      if (lineStr.trim()) {
        pageText += lineStr + '\n';
      }
    });
    
    markdown += `## Page ${pageNum}\n\n${pageText.trim()}\n\n`;
  }
  
  return markdown.trim() + '\n';
}

/**
 * Extract basic dimensions from image File
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ width: 0, height: 0 });
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Convert Image files to structured Markdown (metadata + optional OCR)
 */
export async function convertImage(
  file: File,
  runOcr: boolean = false,
  onProgress?: (msg: string) => void
): Promise<string> {
  const name = file.name;
  const sizeKb = (file.size / 1024).toFixed(1);
  const type = file.type;
  
  let dims = { width: 0, height: 0 };
  try {
    dims = await getImageDimensions(file);
  } catch {
    // Ignore dimension failures
  }
  
  let markdown = `# Image: ${name.replace(/\.[^/.]+$/, '')}\n\n`;
  markdown += `### File Metadata\n\n`;
  markdown += `| Property | Value |\n`;
  markdown += `| --- | --- |\n`;
  markdown += `| **File Name** | ${name} |\n`;
  markdown += `| **Format** | ${type} |\n`;
  markdown += `| **File Size** | ${sizeKb} KB |\n`;
  if (dims.width > 0) {
    markdown += `| **Dimensions** | ${dims.width} x ${dims.height} px |\n`;
    markdown += `| **Aspect Ratio** | ${(dims.width / dims.height).toFixed(2)} |\n`;
  }
  markdown += `\n`;
  
  if (runOcr) {
    if (onProgress) onProgress('Loading OCR Engine (Tesseract)...');
    try {
      const T = await loadTesseract();
      if (T) {
        if (onProgress) onProgress('Initializing engine and language packs...');
        const worker = await T.createWorker('eng');
        
        if (onProgress) onProgress('Reading text from image...');
        const result = await worker.recognize(file);
        await worker.terminate();
        
        const text = result.data.text.trim();
        
        markdown += `### Extracted OCR Text\n\n`;
        if (text) {
          markdown += `\`\`\`text\n${text}\n\`\`\`\n`;
        } else {
          markdown += `*(OCR completed: No readable text detected in the image)*\n`;
        }
      }
    } catch (err: any) {
      markdown += `### Extracted OCR Text\n\n`;
      markdown += `> [!WARNING]\n`;
      markdown += `> OCR processing failed: ${err.message || err}\n`;
    }
  } else {
    markdown += `*Note: On-device OCR was not enabled for this image. Enable OCR in settings to extract readable text contents.*\n`;
  }
  
  return markdown;
}

/**
 * Convert Audio/Video files to structured Markdown (metadata)
 */
export async function convertAudioVideo(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const name = file.name;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const type = file.type;
  
  if (onProgress) onProgress('Analyzing media parameters...');
  
  let markdown = `# Media Details: ${name.replace(/\.[^/.]+$/, '')}\n\n`;
  markdown += `### File Metadata\n\n`;
  markdown += `| Parameter | Value |\n`;
  markdown += `| --- | --- |\n`;
  markdown += `| **File Name** | ${name} |\n`;
  markdown += `| **Media Type** | ${type.split('/')[0].toUpperCase()} |\n`;
  markdown += `| **Mime Type** | ${type} |\n`;
  markdown += `| **File Size** | ${sizeMb} MB |\n`;
  
  // Try to load in audio/video element client-side to read duration
  if (typeof window !== 'undefined') {
    try {
      const duration: number = await new Promise((resolve) => {
        const media = document.createElement(type.startsWith('video') ? 'video' : 'audio');
        media.preload = 'metadata';
        media.src = URL.createObjectURL(file);
        media.onloadedmetadata = () => {
          resolve(media.duration);
        };
        media.onerror = () => {
          resolve(0);
        };
      });
      
      if (duration > 0) {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.round(duration % 60);
        const formatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        markdown += `| **Duration** | ${formatted} (${duration.toFixed(2)} seconds) |\n`;
      }
    } catch {
      // Ignore errors parsing duration
    }
  }
  
  markdown += `\n\n---\n\n`;
  markdown += `### Media Analysis Summary\n\n`;
  markdown += `This file was analyzed via the **MarkDownify** client-side media processor. Since transcription requires large local models, we have parsed the binary headers and structural formats directly in your browser. Feel free to copy these details to document your media library assets!\n`;
  
  return markdown;
}

/**
 * Orchestrate conversion based on file type
 */
export async function convertFile(
  file: File,
  options: { runOcr?: boolean } = {},
  onProgress?: (msg: string) => void
): Promise<{ markdown: string; fileType: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const type = file.type || '';
  
  let markdown = '';
  let fileType = 'Unknown';
  
  onProgress?.('Reading raw file data...');
  
  // 1. Text or Code files
  if (
    type.startsWith('text/') || 
    ['txt', 'js', 'ts', 'jsx', 'tsx', 'vue', 'json', 'css', 'scss', 'py', 'go', 'rs', 'sh', 'bash', 'yml', 'yaml', 'md'].includes(extension)
  ) {
    const text = await file.text();
    fileType = 'Plain Text / Code';
    if (extension === 'json') {
      markdown = convertJsonXml(text, 'json', file.name);
    } else if (extension === 'xml') {
      markdown = convertJsonXml(text, 'xml', file.name);
    } else {
      markdown = convertTextCode(text, extension, file.name);
    }
  } 
  // 2. HTML
  else if (extension === 'html' || extension === 'htm') {
    const text = await file.text();
    fileType = 'HTML Webpage';
    markdown = `# ${file.name.replace(/\.html?$/i, '')}\n\n` + convertHtml(text);
  }
  // 3. Word Document
  else if (extension === 'docx') {
    fileType = 'Word Document (.docx)';
    const arrayBuffer = await file.arrayBuffer();
    markdown = await convertDocx(arrayBuffer, file.name);
  }
  // 4. Excel / Spreadsheet
  else if (['xlsx', 'xls', 'csv'].includes(extension)) {
    fileType = `Spreadsheet (.${extension})`;
    const arrayBuffer = await file.arrayBuffer();
    markdown = await convertXlsx(arrayBuffer, file.name);
  }
  // 5. PowerPoint Presentation
  else if (extension === 'pptx') {
    fileType = 'PowerPoint Slide deck (.pptx)';
    const arrayBuffer = await file.arrayBuffer();
    markdown = await convertPptx(arrayBuffer, file.name);
  }
  // 6. PDF
  else if (extension === 'pdf') {
    fileType = 'PDF Document';
    const arrayBuffer = await file.arrayBuffer();
    markdown = await convertPdf(arrayBuffer, file.name, onProgress);
  }
  // 7. Image
  else if (type.startsWith('image/')) {
    fileType = `Image (${type.split('/')[1].toUpperCase()})`;
    markdown = await convertImage(file, !!options.runOcr, onProgress);
  }
  // 8. Audio / Video
  else if (type.startsWith('audio/') || type.startsWith('video/')) {
    fileType = type.startsWith('video') ? 'Video File' : 'Audio File';
    markdown = await convertAudioVideo(file, onProgress);
  }
  // 9. Unknown fallback
  else {
    fileType = 'Binary / Unknown Format';
    markdown = `# Binary File: ${file.name}\n\n`;
    markdown += `| Attribute | Value |\n`;
    markdown += `| --- | --- |\n`;
    markdown += `| **File Name** | ${file.name} |\n`;
    markdown += `| **Size** | ${(file.size / 1024).toFixed(1)} KB |\n`;
    markdown += `| **Mime Type** | ${file.type || 'unknown'} |\n\n`;
    markdown += `> [!NOTE]\n`;
    markdown += `> This format is currently not directly parseable as rich text inside the web app. You can download this structural overview as a markdown manifest card.\n`;
  }
  
  return { markdown, fileType };
}
