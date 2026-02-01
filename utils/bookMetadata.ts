import { BookMetadata } from './epubParser';

/**
 * Formats a book display name from metadata and filename.
 * Handles title/author formatting and filename fallback with proper capitalization.
 * 
 * @param metadata - Book metadata containing title and author
 * @param fileName - Original filename (used as fallback)
 * @returns Formatted display name string
 */
export function formatBookDisplayName(metadata: BookMetadata, fileName: string): string {
  // Use metadata title if available, otherwise use filename without extension
  let displayName = metadata.title || fileName.replace('.epub', '');
  
  // If both author and title exist, append author on new line
  if (metadata.author && metadata.title) {
    displayName = `${displayName}\nby ${metadata.author}`;
  }
  
  // If no metadata title, format the filename nicely
  if (!metadata.title) {
    displayName = fileName
      .replace('.epub', '')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return displayName;
}

/**
 * Creates a standardized book entry object from URI, metadata, and filename.
 * 
 * @param uri - Book file URI
 * @param metadata - Book metadata
 * @param fileName - Original filename
 * @returns Standardized book entry object
 */
export function createBookEntry(
  uri: string,
  metadata: BookMetadata,
  fileName: string
): { uri: string; name: string; metadata: BookMetadata } {
  return {
    uri,
    name: formatBookDisplayName(metadata, fileName),
    metadata: metadata || {},
  };
}
