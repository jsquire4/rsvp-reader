import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export interface Chapter {
  title: string;
  words: string[];
  wordCount: number;
  htmlContent?: string; // Preserved HTML content for paragraph/page views
  rawText?: string; // Raw text with paragraph breaks preserved
}

export interface BookMetadata {
  title?: string;
  author?: string;
  coverImageUri?: string;
}

/**
 * Extracts book metadata (title, author, cover) from EPUB
 */
export async function extractBookMetadata(epubUri: string): Promise<BookMetadata> {
  try {
    let bytes: Uint8Array;
    
    if (epubUri.startsWith('http://') || epubUri.startsWith('https://') || Platform.OS === 'web') {
      const response = await fetch(epubUri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    } else {
      const epubFile = new File(epubUri);
      const arrayBuffer = await epubFile.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    }
    
    const zip = await JSZip.loadAsync(bytes);
    const parser = new DOMParser();
    
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) return {};
    
    const containerDoc = parser.parseFromString(containerXml, 'text/xml');
    const rootfileElement = containerDoc.getElementsByTagName('rootfile')[0];
    const opfPath = rootfileElement?.getAttribute('full-path');
    if (!opfPath) return {};
    
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) return {};
    
    const opfDoc = parser.parseFromString(opfContent, 'text/xml');
    const metadata = opfDoc.getElementsByTagName('metadata')[0];
    
    const title = metadata?.getElementsByTagName('dc:title')[0]?.textContent || 
                 metadata?.getElementsByTagName('title')[0]?.textContent;
    const author = metadata?.getElementsByTagName('dc:creator')[0]?.textContent ||
                   metadata?.getElementsByTagName('creator')[0]?.textContent;
    
    // Try to find cover image
    let coverImageUri: string | undefined;
    const manifest = opfDoc.getElementsByTagName('manifest')[0];
    if (manifest) {
      const items = manifest.getElementsByTagName('item');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        
        if (id && (id.toLowerCase().includes('cover') || mediaType?.startsWith('image/'))) {
          if (href) {
            const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            coverImageUri = opfDir + href;
            break;
          }
        }
      }
    }
    
    return { title, author, coverImageUri };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {};
  }
}

/**
 * Parses an EPUB file and extracts chapters with text content
 */
export async function parseEpub(epubUri: string): Promise<Chapter[]> {
  try {
    let bytes: Uint8Array;
    
    // Handle different URI types
    if (epubUri.startsWith('http://') || epubUri.startsWith('https://') || Platform.OS === 'web') {
      // For web URLs or web platform, use fetch
      const response = await fetch(epubUri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    } else {
      // For file:// URIs on native platforms, use File API
      const epubFile = new File(epubUri);
      const arrayBuffer = await epubFile.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
    }

    // Load the EPUB as a ZIP file
    const zip = await JSZip.loadAsync(bytes);

    // Read the container.xml to find the OPF file
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) {
      throw new Error('Could not find container.xml in EPUB');
    }

    const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
    const rootfileElement = containerDoc.getElementsByTagName('rootfile')[0];
    const opfPath = rootfileElement?.getAttribute('full-path');
    
    if (!opfPath) {
      throw new Error('Could not find OPF path in container.xml');
    }

    // Read the OPF file to get the manifest (list of content files)
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      throw new Error('Could not find OPF file');
    }

    const opfDoc = new DOMParser().parseFromString(opfContent, 'text/xml');
    const manifestItems = opfDoc.getElementsByTagName('item');
    
    // Extract the directory path from OPF path
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // Get the spine to determine reading order
    const spineItems = opfDoc.getElementsByTagName('itemref');
    const manifestMap = new Map<string, string>();
    
    // Build a map of id -> href from manifest
    for (let i = 0; i < manifestItems.length; i++) {
      const item = manifestItems[i];
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');
      
      if (id && href && mediaType?.includes('html')) {
        // Resolve relative paths
        let fullPath = href;
        if (!href.startsWith('/') && !href.match(/^[a-zA-Z]:/)) {
          // Relative path - resolve against OPF directory
          fullPath = opfDir + href;
        }
        manifestMap.set(id, fullPath);
      }
    }

    // Collect content files in spine order (reading order)
    const contentFiles: string[] = [];
    for (let i = 0; i < spineItems.length; i++) {
      const itemref = spineItems[i];
      const idref = itemref.getAttribute('idref');
      if (idref) {
        const filePath = manifestMap.get(idref);
        if (filePath) {
          contentFiles.push(filePath);
        }
      }
    }

    // If no spine items found, fall back to all HTML files in manifest order
    if (contentFiles.length === 0) {
      manifestMap.forEach((path) => contentFiles.push(path));
    }

    // Parse each content file and extract text as chapters
    const chapters: Chapter[] = [];
    const parser = new DOMParser();

    for (const filePath of contentFiles) {
      const fileContent = await zip.file(filePath)?.async('string');
      if (fileContent) {
        const doc = parser.parseFromString(fileContent, 'text/xml');
        
        // Try to extract chapter title from headings
        const titleElement = doc.getElementsByTagName('h1')[0] || 
                            doc.getElementsByTagName('h2')[0] ||
                            doc.getElementsByTagName('title')[0];
        const title = titleElement ? extractTextFromElement(titleElement as Element).trim() : 
                     `Chapter ${chapters.length + 1}`;
        
        const textContent = extractTextFromElement(doc.documentElement);
        if (textContent.trim()) {
          const words = textToWords([textContent]);
          // Preserve HTML content for paragraph/page views
          const bodyElement = doc.getElementsByTagName('body')[0] || doc.documentElement;
          const htmlContent = extractHTMLContent(bodyElement);
          // Preserve raw text with paragraph breaks
          const rawText = extractTextWithBreaks(doc.documentElement);
          chapters.push({
            title: title || `Chapter ${chapters.length + 1}`,
            words,
            wordCount: words.length,
            htmlContent: htmlContent || undefined,
            rawText: rawText || undefined,
          });
        }
      }
    }

    // Filter out table of contents, copyright, and publisher info
    // Keep: Title, Author, Forward, Prelude, Chapter 1+
    const filteredChapters = chapters.filter((chapter, index) => {
      const titleLower = chapter.title.toLowerCase();
      
      // Skip table of contents
      if (titleLower.includes('table of contents') || titleLower.includes('contents')) {
        return false;
      }
      
      // Skip copyright and publisher info
      if (titleLower.includes('copyright') || 
          titleLower.includes('publisher') ||
          titleLower.includes('published by') ||
          titleLower.includes('all rights reserved')) {
        return false;
      }
      
      // Keep title, author, forward, prelude, and chapters
      if (titleLower.includes('title') || 
          titleLower.includes('author') ||
          titleLower.includes('forward') ||
          titleLower.includes('prelude') ||
          titleLower.includes('chapter') ||
          /^\d+$/.test(chapter.title.trim())) {
        return true;
      }
      
      // For other chapters, check if they have substantial content
      // Skip very short chapters that are likely metadata
      if (chapter.words.length < 50) {
        return false;
      }
      
      return true;
    });

    return filteredChapters;
  } catch (error) {
    console.error('Error parsing EPUB:', error);
    throw error;
  }
}

/**
 * Recursively extracts text from a DOM element, filtering out script and style tags
 */
function extractTextFromElement(element: Element | null): string {
  if (!element) return '';

  // Skip script and style elements
  const tagName = element.tagName?.toLowerCase();
  if (tagName === 'script' || tagName === 'style' || tagName === 'meta') {
    return '';
  }

  let text = '';
  
  // Get direct text nodes
  if (element.childNodes) {
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3) { // Text node
        const nodeValue = node.nodeValue || '';
        // Clean up whitespace and remove XML entities
        text += nodeValue.replace(/\s+/g, ' ').trim() + ' ';
      } else if (node.nodeType === 1) { // Element node
        text += extractTextFromElement(node as Element);
      }
    }
  }

  return text;
}

/**
 * Extracts HTML content preserving structure and formatting
 */
function extractHTMLContent(element: Element | null): string {
  if (!element) return '';

  const tagName = element.tagName?.toLowerCase();
  if (tagName === 'script' || tagName === 'style' || tagName === 'meta') {
    return '';
  }

  let html = '';
  
  if (element.childNodes) {
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3) { // Text node
        html += (node.nodeValue || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      } else if (node.nodeType === 1) { // Element node
        const el = node as Element;
        const childTag = el.tagName?.toLowerCase();
        
        // Preserve important formatting tags
        if (['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(childTag)) {
          const attrs = Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ');
          const openTag = attrs ? `<${childTag} ${attrs}>` : `<${childTag}>`;
          html += openTag + extractHTMLContent(el) + `</${childTag}>`;
        } else {
          html += extractHTMLContent(el);
        }
      }
    }
  }

  return html;
}

/**
 * Extracts text with paragraph breaks preserved
 */
function extractTextWithBreaks(element: Element | null): string {
  if (!element) return '';

  const tagName = element.tagName?.toLowerCase();
  if (tagName === 'script' || tagName === 'style' || tagName === 'meta') {
    return '';
  }

  let text = '';
  
  if (element.childNodes) {
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === 3) { // Text node
        text += node.nodeValue || '';
      } else if (node.nodeType === 1) { // Element node
        const el = node as Element;
        const childTag = el.tagName?.toLowerCase();
        
        // Add line breaks for paragraph and div tags
        if (childTag === 'p' || childTag === 'div') {
          if (text && !text.endsWith('\n\n')) {
            text += '\n\n';
          }
        } else if (childTag === 'br') {
          text += '\n';
        }
        text += extractTextWithBreaks(el);
      }
    }
  }

  return text;
}

/**
 * Converts parsed EPUB text into an array of words, cleaning XML/HTML entities and tags
 * Punctuation is attached to words: end punctuation at end, opening punctuation at beginning
 */
export function textToWords(textArray: string[]): string[] {
  const allText = textArray.join(' ');
  
  // Remove HTML/XML entities and decode them
  let cleaned = allText
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&[a-zA-Z]+;/g, ' ') // Remove other named entities
    .replace(/&#\d+;/g, ' ') // Remove numeric entities
    .replace(/<[^>]+>/g, ' ') // Remove any remaining HTML/XML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Define punctuation patterns
  // End punctuation: .,!?;:)]}"'»›
  // Opening punctuation: ([{"'«‹
  // Dashes: -–— (hyphen, en-dash, em-dash)
  
  const words: string[] = [];
  let currentWord = '';
  let i = 0;
  
  while (i < cleaned.length) {
    const char = cleaned[i];
    
    if (/\s/.test(char)) {
      // Whitespace - finish current word if any
      if (currentWord.trim().length > 0) {
        words.push(currentWord.trim());
        currentWord = '';
      }
      i++;
      continue;
    }
    
    // Check for opening punctuation or dashes at start
    if (/[([{"'«‹–—]/.test(char) && currentWord.trim().length === 0) {
      currentWord += char;
      i++;
      continue;
    }
    
    // Check for end punctuation
    if (/[.,!?;:)\]}"'»›]/.test(char)) {
      // Add to current word if we have one, otherwise start new word
      if (currentWord.trim().length > 0) {
        currentWord += char;
        words.push(currentWord.trim());
        currentWord = '';
      } else {
        // Standalone punctuation - attach to previous word if exists
        if (words.length > 0) {
          words[words.length - 1] += char;
        }
      }
      i++;
      continue;
    }
    
    // Regular character
    currentWord += char;
    i++;
  }
  
  // Add final word if any
  if (currentWord.trim().length > 0) {
    words.push(currentWord.trim());
  }
  
  // Filter out empty strings and ensure words contain at least one letter
  return words.filter(word => {
    const trimmed = word.trim();
    return trimmed.length > 0 && /[a-zA-Z]/.test(trimmed);
  });
}

