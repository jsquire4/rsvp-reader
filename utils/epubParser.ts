import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

export interface Chapter {
  title: string;
  words: string[];
  wordCount: number;
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
          chapters.push({
            title: title || `Chapter ${chapters.length + 1}`,
            words,
            wordCount: words.length,
          });
        }
      }
    }

    return chapters;
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

