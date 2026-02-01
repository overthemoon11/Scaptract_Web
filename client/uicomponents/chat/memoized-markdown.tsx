import React, { useMemo, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MemoizedMarkdownProps {
  id: string;
  content: string;
  groupname?: string | null; // Optional groupname for image path conversion
  searchTerm?: string; // Optional search term for highlighting
}

export function MemoizedMarkdown({ id, content, groupname, searchTerm }: MemoizedMarkdownProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    if (!content) return '';

    // Clean up OCR artifacts: \text{&quot;}...\text{&quot;} patterns
    // Replace \text{&quot;}char\text{&quot;} with 'char'
    let cleanedContent = content;
    
    // Convert relative image paths to API URLs if groupname is provided
    if (groupname) {
      console.log(`[MemoizedMarkdown] Processing images with groupname: "${groupname}"`);
      // Helper function to properly encode image paths
      // Handles both relative paths and already-encoded API paths
      const encodeImagePath = (imgPath: string): string => {
        console.log(`[MemoizedMarkdown] encodeImagePath called - Original path: "${imgPath}", groupname: "${groupname}"`);
        
        // If path is already an API URL, extract the image path part and re-encode it properly
        if (imgPath.startsWith('/api/documents/ocr-images/')) {
          console.log(`[MemoizedMarkdown] Path is already an API URL`);
          // Extract everything after /ocr-images/
          const pathMatch = imgPath.match(/\/ocr-images\/(.+)$/);
          if (pathMatch) {
            const fullPath = pathMatch[1];
            console.log(`[MemoizedMarkdown] Extracted fullPath: "${fullPath}"`);
            
            // Decode first in case it's already encoded (handles %2F, %20, etc.)
            try {
              const decodedPath = decodeURIComponent(fullPath);
              console.log(`[MemoizedMarkdown] Decoded path: "${decodedPath}"`);
              
              // Split into segments
              const pathSegments = decodedPath.split('/').filter(seg => seg.length > 0);
              console.log(`[MemoizedMarkdown] Path segments:`, pathSegments);
              
              // Remove any duplicate groupname segments at the start
              // Keep only the actual image path (everything after the groupname(s))
              let startIndex = 0;
              const encodedGroupname = encodeURIComponent(groupname);
              console.log(`[MemoizedMarkdown] Looking for groupname: "${groupname}" (encoded: "${encodedGroupname}")`);
              
              // Skip all groupname segments at the beginning
              while (startIndex < pathSegments.length) {
                const segment = pathSegments[startIndex];
                console.log(`[MemoizedMarkdown] Checking segment[${startIndex}]: "${segment}"`);
                
                // Try to decode the segment to compare
                try {
                  const decodedSegment = decodeURIComponent(segment);
                  console.log(`[MemoizedMarkdown] Decoded segment: "${decodedSegment}"`);
                  
                  // If this segment matches the groupname (encoded or decoded), skip it
                  if (segment === encodedGroupname || decodedSegment === groupname) {
                    console.log(`[MemoizedMarkdown] Segment matches groupname, skipping (startIndex: ${startIndex} -> ${startIndex + 1})`);
                    startIndex++;
                  } else {
                    console.log(`[MemoizedMarkdown] Segment does not match groupname, stopping`);
                    break;
                  }
                } catch {
                  // If decoding fails, compare as-is
                  console.log(`[MemoizedMarkdown] Failed to decode segment, comparing as-is`);
                  if (segment === encodedGroupname || segment === groupname) {
                    console.log(`[MemoizedMarkdown] Segment matches groupname (as-is), skipping`);
                    startIndex++;
                  } else {
                    console.log(`[MemoizedMarkdown] Segment does not match groupname (as-is), stopping`);
                    break;
                  }
                }
              }
              
              // Get the remaining path (actual image path)
              const imagePathSegments = pathSegments.slice(startIndex);
              console.log(`[MemoizedMarkdown] Remaining image path segments (after removing ${startIndex} groupname segments):`, imagePathSegments);
              
              if (imagePathSegments.length === 0) {
                // If no path remains, return the original (shouldn't happen, but safety check)
                console.warn(`[MemoizedMarkdown] No image path segments remaining, returning original path`);
                return imgPath;
              }
              
              // Encode each segment properly
              const encodedSegments = imagePathSegments.map(segment => {
                try {
                  // Decode first to handle double-encoding, then re-encode
                  const decoded = decodeURIComponent(segment);
                  const encoded = encodeURIComponent(decoded);
                  console.log(`[MemoizedMarkdown] Encoded segment: "${segment}" -> "${encoded}"`);
                  return encoded;
                } catch {
                  // If it's not encoded, encode it
                  const encoded = encodeURIComponent(segment);
                  console.log(`[MemoizedMarkdown] Encoded segment (no decode): "${segment}" -> "${encoded}"`);
                  return encoded;
                }
              });
              const properlyEncodedPath = encodedSegments.join('/');
              const finalPath = `/api/documents/ocr-images/${encodeURIComponent(groupname)}/${properlyEncodedPath}`;
              console.log(`[MemoizedMarkdown] Final encoded path: "${finalPath}"`);
              return finalPath;
            } catch (e) {
              console.error(`[MemoizedMarkdown] Error decoding fullPath:`, e);
              // If decoding fails, try to extract path after groupname pattern
              // Split by '/' and find where the actual image path starts
              const segments = fullPath.split('/').filter(seg => seg.length > 0);
              console.log(`[MemoizedMarkdown] Fallback: segments from fullPath:`, segments);
              const encodedGroupname = encodeURIComponent(groupname);
              
              // Find the first segment that's not the groupname
              let startIndex = 0;
              while (startIndex < segments.length) {
                const segment = segments[startIndex];
                console.log(`[MemoizedMarkdown] Fallback: Checking segment[${startIndex}]: "${segment}"`);
                
                // Try to decode and compare
                try {
                  const decodedSegment = decodeURIComponent(segment);
                  if (decodedSegment === groupname || segment === encodedGroupname) {
                    console.log(`[MemoizedMarkdown] Fallback: Segment matches, skipping`);
                    startIndex++;
                  } else {
                    console.log(`[MemoizedMarkdown] Fallback: Segment does not match, stopping`);
                    break;
                  }
                } catch {
                  if (segment === encodedGroupname || segment === groupname) {
                    console.log(`[MemoizedMarkdown] Fallback: Segment matches (as-is), skipping`);
                    startIndex++;
                  } else {
                    console.log(`[MemoizedMarkdown] Fallback: Segment does not match (as-is), stopping`);
                    break;
                  }
                }
              }
              
              if (startIndex >= segments.length) {
                // All segments are groupname, return original
                console.warn(`[MemoizedMarkdown] Fallback: All segments are groupname, returning original`);
                return imgPath;
              }
              
              const imagePathSegments = segments.slice(startIndex);
              console.log(`[MemoizedMarkdown] Fallback: Remaining segments:`, imagePathSegments);
              
              const encodedSegments = imagePathSegments.map(segment => {
                try {
                  const decoded = decodeURIComponent(segment);
                  return encodeURIComponent(decoded);
                } catch {
                  return encodeURIComponent(segment);
                }
              });
              const properlyEncodedPath = encodedSegments.join('/');
              const finalPath = `/api/documents/ocr-images/${encodeURIComponent(groupname)}/${properlyEncodedPath}`;
              console.log(`[MemoizedMarkdown] Fallback: Final path: "${finalPath}"`);
              return finalPath;
            }
          } else {
            console.warn(`[MemoizedMarkdown] Failed to match /ocr-images/ pattern in path: "${imgPath}"`);
          }
        }
        
        // Handle relative paths (./imgs/ or imgs/)
        console.log(`[MemoizedMarkdown] Processing relative path: "${imgPath}"`);
        let cleanPath = imgPath.replace(/^\.\//, '');
        console.log(`[MemoizedMarkdown] Cleaned path: "${cleanPath}"`);
        
        // Remove groupname from the start of the path if it's present
        if (cleanPath.startsWith(groupname + '/')) {
          cleanPath = cleanPath.substring(groupname.length + 1);
          console.log(`[MemoizedMarkdown] Removed groupname from start, new path: "${cleanPath}"`);
        } else if (cleanPath === groupname) {
          cleanPath = '';
          console.log(`[MemoizedMarkdown] Path was just groupname, cleared it`);
        }
        
        // Normalize path separators to forward slashes
        const urlPath = cleanPath.replace(/\\/g, '/');
        console.log(`[MemoizedMarkdown] Normalized path: "${urlPath}"`);
        
        // Split path into segments and encode each segment separately
        // This ensures spaces and special characters in filenames are properly encoded
        // while keeping path separators (/) unencoded
        const pathSegments = urlPath.split('/').filter(seg => seg.length > 0);
        console.log(`[MemoizedMarkdown] Path segments:`, pathSegments);
        
        // Remove any groupname segments from the path
        const filteredSegments = pathSegments.filter(segment => {
          const isGroupname = segment === groupname || decodeURIComponent(segment) === groupname;
          if (isGroupname) {
            console.log(`[MemoizedMarkdown] Filtering out groupname segment: "${segment}"`);
          }
          return !isGroupname;
        });
        console.log(`[MemoizedMarkdown] Filtered path segments (removed groupname):`, filteredSegments);
        
        if (filteredSegments.length === 0) {
          console.warn(`[MemoizedMarkdown] No segments remaining after filtering, returning original`);
          return imgPath;
        }
        
        const encodedSegments = filteredSegments.map(segment => {
          const encoded = encodeURIComponent(segment);
          console.log(`[MemoizedMarkdown] Encoded segment: "${segment}" -> "${encoded}"`);
          return encoded;
        });
        const encodedPath = encodedSegments.join('/');
        const finalPath = `/api/documents/ocr-images/${encodeURIComponent(groupname)}/${encodedPath}`;
        console.log(`[MemoizedMarkdown] Final relative path: "${finalPath}"`);
        return finalPath;
      };
      
      // Handle HTML img tags: <img src="imgs/..." or <img src="./imgs/..." or <img src="/api/..."
      cleanedContent = cleanedContent.replace(
        /(<img[^>]+src=["'])([^"']+)(["'])/gi,
        (_match, prefix, imgPath, suffix) => {
          console.log(`[MemoizedMarkdown] Found HTML img tag with src: "${imgPath}"`);
          // Only process if it's a relative path or an API path that needs fixing
          if (imgPath.includes('imgs/') || imgPath.startsWith('/api/documents/ocr-images/')) {
            console.log(`[MemoizedMarkdown] Processing HTML img path: "${imgPath}"`);
            const apiPath = encodeImagePath(imgPath);
            console.log(`[MemoizedMarkdown] Converted HTML img path: "${imgPath}" -> "${apiPath}"`);
            return `${prefix}${apiPath}${suffix}`;
          }
          // Leave other paths (absolute URLs, data URIs, etc.) as-is
          console.log(`[MemoizedMarkdown] Skipping HTML img path (not imgs/ or API path): "${imgPath}"`);
          return `${prefix}${imgPath}${suffix}`;
        }
      );
      
      // Handle markdown image syntax: ![alt](imgs/...) or ![alt](/api/...)
      cleanedContent = cleanedContent.replace(
        /(!\[[^\]]*\]\()([^)]+)(\))/gi,
        (_match, prefix, imgPath, suffix) => {
          console.log(`[MemoizedMarkdown] Found markdown image syntax with path: "${imgPath}"`);
          // Only process if it's a relative path or an API path that needs fixing
          if (imgPath.includes('imgs/') || imgPath.startsWith('/api/documents/ocr-images/')) {
            console.log(`[MemoizedMarkdown] Processing markdown image path: "${imgPath}"`);
            const apiPath = encodeImagePath(imgPath);
            console.log(`[MemoizedMarkdown] Converted markdown image path: "${imgPath}" -> "${apiPath}"`);
            return `${prefix}${apiPath}${suffix}`;
          }
          // Leave other paths as-is
          console.log(`[MemoizedMarkdown] Skipping markdown image path (not imgs/ or API path): "${imgPath}"`);
          return `${prefix}${imgPath}${suffix}`;
        }
      );
    }
    
    // Handle \text{&quot;}content\text{&quot;} (HTML entity version) - replace with single quotes
    cleanedContent = cleanedContent.replace(/\\text\{&quot;\}([^\\]+?)\\text\{&quot;\}/g, "'$1'");
    
    // Handle exact pattern: \text{"}content\text{"} - replace with single quotes
    cleanedContent = cleanedContent.replace(/\\text\{"\}([^\\]+?)\\text\{"\}/g, "'$1'");
    
    // Handle \text{\"}content\text{\"} (LaTeX escaped version with backslash)
    cleanedContent = cleanedContent.replace(/\\text\{\\"\}([^\\]+?)\\text\{\\"\}/g, "'$1'");
    
    // Handle with optional spaces: \text{ " }content\text{ " } or \text{ &quot; }content\text{ &quot; }
    cleanedContent = cleanedContent.replace(/\\text\{\s*"\s*\}([^\\]+?)\\text\{\s*"\s*\}/g, "'$1'");
    cleanedContent = cleanedContent.replace(/\\text\{\s*&quot;\s*\}([^\\]+?)\\text\{\s*&quot;\s*\}/g, "'$1'");
    
    // Fallback: match any \text{...} pattern where braces contain quote-like characters
    cleanedContent = cleanedContent.replace(/\\text\{[^}]*["'&]quot;?[^}]*\}([^\\]+?)\\text\{[^}]*["'&]quot;?[^}]*\}/g, "'$1'");

    // Process markdown tables first (before other markdown processing)
    // Split content into lines and process line by line to detect tables
    const allLines = cleanedContent.split(/\r?\n/);
    const processedLines: string[] = [];
    let i = 0;

    while (i < allLines.length) {
      const line = allLines[i];
      const trimmed = line.trim();
      
      // Check if this line looks like a table row (starts and ends with |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        // Collect consecutive table rows
        const tableRows: string[] = [];
        let j = i;
        
        while (j < allLines.length) {
          const currentLine = allLines[j].trim();
          if (currentLine.startsWith('|') && currentLine.endsWith('|')) {
            tableRows.push(allLines[j]);
            j++;
          } else {
            break;
          }
        }

        // Check if we have a valid table (at least header + separator + 1 data row)
        if (tableRows.length >= 3) {
          // Check if second row is a separator (contains dashes or colons)
          const secondRow = tableRows[1].trim();
          const isSeparator = /^[\|\s:\-]+$/.test(secondRow);
          
          if (isSeparator) {
            // Process as table
            const headerRow = tableRows[0];
            const headerCells = headerRow
              .split('|')
              .map(cell => cell.trim())
              .filter(cell => cell && !cell.match(/^[\-: ]+$/));

            if (headerCells.length > 0) {
              const dataRows = tableRows.slice(2);

              let tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse !border !border-gray-300 dark:!border-dark-400" style="border: 1px solid rgb(209 213 219);">';
              
              // Header row
              tableHtml += '<thead><tr class="bg-gray-100 dark:bg-dark-600">';
              headerCells.forEach(cell => {
                tableHtml += `<th class="!border !border-gray-300 dark:!border-dark-400 px-4 py-2 text-left font-semibold text-gray-900 dark:text-dark-50" style="border: 1px solid rgb(209 213 219);">${cell}</th>`;
              });
              tableHtml += '</tr></thead>';

              // Data rows
              if (dataRows.length > 0) {
                tableHtml += '<tbody>';
                dataRows.forEach(row => {
                  const cells = row
                    .split('|')
                    .map(cell => cell.trim())
                    .filter(cell => cell);
                  
                  if (cells.length > 0) {
                    tableHtml += '<tr class="hover:bg-gray-50 dark:hover:bg-dark-700">';
                    // Ensure we have the same number of cells as headers
                    for (let k = 0; k < headerCells.length; k++) {
                      const cellContent = cells[k] || '';
                      tableHtml += `<td class="!border !border-gray-300 dark:!border-dark-400 px-4 py-2 text-gray-700 dark:text-dark-100" style="border: 1px solid rgb(209 213 219);">${cellContent}</td>`;
                    }
                    tableHtml += '</tr>';
                  }
                });
                tableHtml += '</tbody>';
              } else {
                tableHtml += '<tbody></tbody>';
              }

              tableHtml += '</table></div>';
              processedLines.push(tableHtml);
              i = j; // Skip processed table rows
              continue;
            }
          }
        }
        
        // Not a table, add line as-is
        processedLines.push(line);
        i++;
      } else {
        processedLines.push(line);
        i++;
      }
    }

    let html = processedLines.join('\n');

    // Remove standalone --- lines and combine with previous line (OCR artifact handling)
    // This prevents --- from creating unwanted line breaks - combine it with previous content
    // Match: newline, optional whitespace, 3+ hyphens, optional whitespace, newline
    // Replace with: space (to combine with previous word) or just remove the line
    html = html.replace(/\n[\s]*-{3,}[\s]*\n/g, ' ');
    // Also handle --- at start or end of content
    html = html.replace(/^[\s]*-{3,}[\s]*\n/g, '');
    html = html.replace(/\n[\s]*-{3,}[\s]*$/g, '');

    // Preserve HTML blocks (tables, divs, images) before markdown processing
    // This prevents markdown regex from interfering with HTML content
    const htmlBlocks: string[] = [];
    const htmlPlaceholders: string[] = [];
    
    // Match HTML blocks (divs, tables, images, etc.)
    // Also add border styles to existing HTML tables from OCR
    html = html.replace(/(<div[^>]*>[\s\S]*?<\/div>|<table[^>]*>[\s\S]*?<\/table>|<img[^>]*>)/gi, (match) => {
      // If it's a table without proper border styling, add it
      if (match.startsWith('<table')) {
        // Check if table already has border styles
        if (!match.includes('border') && !match.includes('style=')) {
          // Add border classes and inline style
          match = match.replace(
            /<table([^>]*)>/i,
            '<table$1 class="min-w-full border-collapse !border !border-gray-300 dark:!border-dark-400" style="border: 1px solid rgb(209 213 219);">'
          );
          // Add borders to th and td elements
          match = match.replace(
            /<th([^>]*)>/gi,
            '<th$1 class="!border !border-gray-300 dark:!border-dark-400 px-4 py-2" style="border: 1px solid rgb(209 213 219);">'
          );
          match = match.replace(
            /<td([^>]*)>/gi,
            '<td$1 class="!border !border-gray-300 dark:!border-dark-400 px-4 py-2" style="border: 1px solid rgb(209 213 219);">'
          );
        }
      }
      
      const placeholder = `__HTML_BLOCK_${htmlBlocks.length}__`;
      htmlBlocks.push(match);
      htmlPlaceholders.push(placeholder);
      return placeholder;
    });

    // Process LaTeX formulas (before other markdown processing to avoid conflicts)
    // Process block math FIRST to avoid conflicts with inline math
    
    // Block math: \[...\] - match literal backslash-bracket (multiline support)
    // Use [\s\S] instead of . to match newlines
    html = html.replace(/\\(\[([\s\S]+?)\\\])/g, (_match, _full, formula) => {
      const escaped = formula.replace(/"/g, '&quot;').replace(/&/g, '&amp;').trim();
      return `<div class="katex-block my-4" data-formula="${escaped}"></div>`;
    });
    
    // Also support $$...$$ syntax for block math (multiline support)
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
      const escaped = formula.replace(/"/g, '&quot;').replace(/&/g, '&amp;').trim();
      return `<div class="katex-block my-4" data-formula="${escaped}"></div>`;
    });

    // Inline math: \(...\) - match literal backslash-parenthesis
    // Pattern: \\( matches \(, (.+?) captures formula, \\) matches \)
    html = html.replace(/\\(\((.+?)\\\))/g, (_match, _fullMatch, formula) => {
      const escaped = formula.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
      return `<span class="katex-inline" data-formula="${escaped}"></span>`;
    });
    
    // Also support $...$ syntax for inline math (but not $$...$$)
    html = html.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_match, formula) => {
      const escaped = formula.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
      return `<span class="katex-inline" data-formula="${escaped}"></span>`;
    });

    // Fix spacing issue: remove space between single capital letter and following lowercase letter
    // Pattern: "I ntroduction" -> "Introduction", "A bstract" -> "Abstract"
    // Apply this fix before any markdown processing
    html = html.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
    
    // Simple markdown to HTML conversion
    html = html
      // Remove standalone --- lines and combine with previous line (OCR artifact handling)
      // Match lines that contain only --- (with optional whitespace) and remove them
      // This prevents --- from creating unwanted line breaks
      .replace(/\n[\s]*-{3,}[\s]*\n/gim, ' ')
      .replace(/^[\s]*-{3,}[\s]*\n/gim, '')
      .replace(/\n[\s]*-{3,}[\s]*$/gim, '')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-dark-50">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-900 dark:text-dark-50">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-dark-50">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="bg-gray-100 dark:bg-dark-600 p-3 rounded-md overflow-x-auto my-2"><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code class="bg-gray-100 dark:bg-dark-600 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-primary-600 hover:text-primary-700 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Line breaks
      .replace(/\n\n/gim, '</p><p class="mb-2 text-gray-700 dark:text-dark-100">')
      .replace(/\n/gim, '<br />')
      // Lists
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');

    // Wrap list items in ul tags
    html = html.replace(/(<li.*<\/li>)/gim, '<ul class="my-2 space-y-1">$1</ul>');

    // Restore HTML blocks after markdown processing
    htmlPlaceholders.forEach((placeholder, index) => {
      html = html.replace(placeholder, htmlBlocks[index]);
    });

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = `<p class="mb-2 text-gray-700 dark:text-dark-100">${html}</p>`;
    }

    // Apply search highlighting if searchTerm is provided
    if (searchTerm && searchTerm.trim()) {
      const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(`(${escapedSearchTerm})`, 'gi');
      
      console.log(`[MemoizedMarkdown] Applying search highlighting for term: "${searchTerm}"`);
      
      // Use DOM manipulation to safely highlight text content only
      // This avoids highlighting inside HTML tags, attributes, or special elements
      if (typeof window !== 'undefined' && window.document) {
        const tempDiv = window.document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Function to recursively highlight text in a node
        const highlightTextInNode = (node: Node): void => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const text = textNode.textContent || '';
            // Create a fresh regex for testing (avoid global regex state issues)
            const testRegex = new RegExp(`(${escapedSearchTerm})`, 'gi');
            if (text && testRegex.test(text)) {
              // Reset regex before splitting
              testRegex.lastIndex = 0;
              // Split text by search term (capturing group includes matches in array)
              const parts = text.split(searchRegex);
              const fragment = window.document.createDocumentFragment();
              
              // Create a case-insensitive test regex for matching parts
              const matchTestRegex = new RegExp(`^${escapedSearchTerm}$`, 'i');
              
              parts.forEach((part) => {
                if (part) {
                  // Check if this part matches the search term (case-insensitive)
                  if (matchTestRegex.test(part)) {
                    const mark = window.document.createElement('mark');
                    mark.style.backgroundColor = '#ffeb3b';
                    mark.style.padding = '2px 0';
                    mark.style.borderRadius = '2px';
                    mark.textContent = part;
                    fragment.appendChild(mark);
                  } else {
                    fragment.appendChild(window.document.createTextNode(part));
                  }
                }
              });
              
              // Replace the text node with the fragment
              if (textNode.parentNode) {
                textNode.parentNode.replaceChild(fragment, textNode);
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();
            
            // Skip highlighting inside these elements
            if (tagName === 'mark' || tagName === 'code' || tagName === 'pre' || 
                element.classList.contains('katex-inline') || 
                element.classList.contains('katex-block')) {
              return;
            }
            
            // Recursively process child nodes
            const children = Array.from(node.childNodes);
            children.forEach(child => highlightTextInNode(child));
          }
        };
        
        // Highlight text in all nodes
        Array.from(tempDiv.childNodes).forEach(node => highlightTextInNode(node));
        
        html = tempDiv.innerHTML;
        console.log(`[MemoizedMarkdown] Search highlighting applied. HTML length: ${html.length}`);
      }
    } else if (searchTerm) {
      console.log(`[MemoizedMarkdown] Search term is empty after trim: "${searchTerm}"`);
    }

    return html;
  }, [content, groupname, searchTerm]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use a small timeout to ensure DOM is ready after dangerouslySetInnerHTML
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      // Force table borders to be visible (override prose styles)
      const tables = containerRef.current.querySelectorAll('table');
      tables.forEach((table) => {
        (table as HTMLElement).style.border = '1px solid rgb(209, 213, 219)';
        (table as HTMLElement).style.borderCollapse = 'collapse';
        
        const thElements = table.querySelectorAll('th');
        thElements.forEach((th) => {
          (th as HTMLElement).style.border = '1px solid rgb(209, 213, 219)';
        });
        
        const tdElements = table.querySelectorAll('td');
        tdElements.forEach((td) => {
          (td as HTMLElement).style.border = '1px solid rgb(209, 213, 219)';
        });
      });

      // Render inline formulas - always re-render when content changes
      const inlineElements = containerRef.current.querySelectorAll('.katex-inline');
      inlineElements.forEach((el) => {
        const formula = el.getAttribute('data-formula');
        if (formula) {
          try {
            // Clear the element first (important: katex.render appends to element)
            el.innerHTML = '';
            katex.render(formula, el as HTMLElement, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (e) {
            // If rendering fails, show the raw formula
            el.textContent = `\\(${formula}\\)`;
          }
        }
      });

      // Render block formulas - always re-render when content changes
      const blockElements = containerRef.current.querySelectorAll('.katex-block');
      blockElements.forEach((el) => {
        const formula = el.getAttribute('data-formula');
        if (formula) {
          try {
            // Clear the element first (important: katex.render appends to element)
            el.innerHTML = '';
            // Trim the formula in case there are extra newlines
            const trimmedFormula = formula.trim();
            katex.render(trimmedFormula, el as HTMLElement, {
              throwOnError: false,
              displayMode: true,
            });
          } catch (e) {
            // If rendering fails, show the raw formula
            console.warn('KaTeX block math rendering error:', e, 'Formula:', formula);
            el.textContent = `\\[${formula}\\]`;
          }
        }
      });
    }, 10); // Small delay to ensure DOM is updated

    return () => clearTimeout(timer);
  }, [htmlContent]);

  return (
    <>
      <style>{`
        #${id} table {
          border: 1px solid rgb(209, 213, 219) !important;
          border-collapse: collapse !important;
        }
        #${id} table th,
        #${id} table td {
          border: 1px solid rgb(209, 213, 219) !important;
          padding: 0.5rem 1rem !important;
        }
        #${id}.dark table,
        #${id} .dark table {
          border-color: rgb(75, 85, 99) !important;
        }
        #${id}.dark table th,
        #${id}.dark table td,
        #${id} .dark table th,
        #${id} .dark table td {
          border-color: rgb(75, 85, 99) !important;
        }
      `}</style>
      <div
        ref={containerRef}
        id={id}
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </>
  );
}

