import { useEffect, useState, useRef } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/AdminFAQAdd.module.css';
import { User, ApiError } from '@shared/types';
import Loading from '@/components/Loading';

interface DocumentData {
  id: string;
  original_name: string;
  file_name: string;
  display_name?: string | null;
  group_name?: string | null;
  status: string;
  extracted_text?: string | null;
  structured_data?: any;
}

interface DocumentResponse {
  success?: boolean;
  error?: string;
}

export default function EditDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const headingButtonClickedRef = useRef<boolean>(false);
  
  // Debug: Monitor focus changes globally
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = window.document.activeElement;
      console.log('[Global Focus] Active element changed:', {
        tagName: activeElement?.tagName,
        id: activeElement?.id,
        className: activeElement?.className,
        textContent: activeElement?.textContent?.substring(0, 50),
        isEditor: activeElement === editorRef.current,
        isH1Button: activeElement?.textContent?.trim() === 'H1' && activeElement?.tagName === 'BUTTON',
        timestamp: Date.now()
      });
    };
    
    window.document.addEventListener('focusin', handleFocusChange);
    window.document.addEventListener('focusout', handleFocusChange);
    
    return () => {
      window.document.removeEventListener('focusin', handleFocusChange);
      window.document.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        if (id) {
          const docRes = await fetch(`/api/admin/document/${id}`, { credentials: 'include' });
          const docData = await docRes.json();
          if (docData.success && docData.document) {
            setDocument(docData.document);
            setExtractedText(docData.document.extracted_text || '');
            // Load content into editor
            if (editorRef.current && docData.document.extracted_text) {
              const html = convertMarkdownToHTML(docData.document.extracted_text);
              console.log('[Load] Converted markdown to HTML:', html.substring(0, 200));
              editorRef.current.innerHTML = html;
              
              // Normalize: Convert any H1s that are actually body text to paragraphs
              // This fixes cases where content was incorrectly saved as headings
              const h1Elements = editorRef.current.querySelectorAll('h1');
              h1Elements.forEach((h1) => {
                // Check if this H1 is actually a heading (short, likely a title) or body text
                const text = h1.textContent || '';
                // If it's longer than 100 chars or contains sentence-ending punctuation, it's probably body text
                if (text.length > 100 || (text.includes('.') && text.length > 50)) {
                  console.log('[Load] Converting H1 to paragraph:', text.substring(0, 50));
                  const p = window.document.createElement('p');
                  p.innerHTML = h1.innerHTML;
                  h1.replaceWith(p);
                }
              });
              
              // Ensure editor always starts with at least one paragraph if empty
              if (!editorRef.current.innerHTML.trim() || editorRef.current.innerHTML.trim() === '<br>') {
                editorRef.current.innerHTML = '<p></p>';
              }
            } else if (editorRef.current) {
              // Initialize with empty paragraph
              editorRef.current.innerHTML = '<p></p>';
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, [id]);

  // Convert markdown to HTML for display in editor
  function convertMarkdownToHTML(markdown: string): string {
    if (!markdown) return '<p></p>';
    
    const lines = markdown.split('\n');
    let html = '';
    let inParagraph = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for headings (must start with # and have space after)
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Close any open paragraph
        if (inParagraph) {
          html += '</p>';
          inParagraph = false;
        }
        
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        html += `<h${level}>${text}</h${level}>`;
      } else if (trimmedLine === '') {
        // Empty line - close paragraph if open and start new one
        if (inParagraph) {
          html += '</p>';
          inParagraph = false;
        }
        // Don't add anything for empty lines - they'll create new paragraphs
      } else {
        // Regular content - always wrap in paragraph
        if (!inParagraph) {
          html += '<p>';
          inParagraph = true;
        } else {
          // If already in paragraph, add line break for continuation
          html += '<br>';
        }
        // Escape HTML to prevent XSS
        html += trimmedLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }
    
    // Close any open paragraph
    if (inParagraph) {
      html += '</p>';
    }
    
    // Ensure we always have at least one paragraph
    return html || '<p></p>';
  }

  // Convert HTML back to markdown
  function convertHTMLToMarkdown(html: string): string {
    // Create a temporary div to parse HTML
    const tempDiv = window.document.createElement('div');
    tempDiv.innerHTML = html;
    
    let markdown = '';
    const nodes = Array.from(tempDiv.childNodes);
    
    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        
        if (tagName.match(/^h[1-6]$/)) {
          const level = parseInt(tagName.charAt(1));
          const text = element.textContent || '';
          markdown += '#'.repeat(level) + ' ' + text + '\n\n';
        } else if (tagName === 'p') {
          const text = element.textContent || '';
          if (text.trim()) {
            markdown += text + '\n\n';
          }
        } else if (tagName === 'br') {
          markdown += '\n';
        } else {
          const text = element.textContent || '';
          if (text.trim()) {
            markdown += text + '\n\n';
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim()) {
          markdown += text + '\n\n';
        }
      }
    }
    
    return markdown.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Parse HTML content and update structured_data
  function parseContentAndUpdateStructuredData(html: string, originalStructuredData: any): any {
    const markdown = convertHTMLToMarkdown(html);
    const lines = markdown.split('\n');
    
    const content: Record<string, string> = {};
    const sectionOrder: string[] = [];
    const sections: Array<{
      type: string;
      level: number;
      title: string;
      content: string;
    }> = [];
    
    let currentSection: { title: string; level: number; content: string[] } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;
      
      // Check if it's a heading
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          const sectionContent = currentSection.content.join('\n').trim();
          const sectionTitle = currentSection.title.trim();
          
          // Only add if title is not empty
          if (sectionTitle) {
            content[sectionTitle] = sectionContent;
            if (!sectionOrder.includes(sectionTitle)) {
              sectionOrder.push(sectionTitle);
            }
            
            sections.push({
              type: 'section',
              level: currentSection.level,
              title: sectionTitle,
              content: sectionContent
            });
          }
        }
        
        // Start new section
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        if (title) {
          currentSection = {
            title,
            level,
            content: []
          };
        }
      } else if (currentSection) {
        // Add content to current section
        currentSection.content.push(trimmedLine);
      } else {
        // Content before first heading - could be title or abstract
        // Only treat as section if it looks like a title (short line, no heading found yet)
        if (sectionOrder.length === 0 && trimmedLine.length < 200) {
          const title = trimmedLine;
          content[title] = '';
          sectionOrder.push(title);
          sections.push({
            type: 'section',
            level: 1,
            title,
            content: ''
          });
          currentSection = {
            title,
            level: 1,
            content: []
          };
        }
      }
    }
    
    // Save last section
    if (currentSection) {
      const sectionContent = currentSection.content.join('\n').trim();
      const sectionTitle = currentSection.title.trim();
      
      if (sectionTitle) {
        content[sectionTitle] = sectionContent;
        if (!sectionOrder.includes(sectionTitle)) {
          sectionOrder.push(sectionTitle);
        }
        
        sections.push({
          type: 'section',
          level: currentSection.level,
          title: sectionTitle,
          content: sectionContent
        });
      }
    }
    
    // Preserve metadata and other fields from original structured_data
    const updatedStructuredData = {
      ...(originalStructuredData || {}),
      content,
      sectionOrder,
      structured_elements: {
        images: originalStructuredData?.structured_elements?.images || [],
        tables: originalStructuredData?.structured_elements?.tables || [],
        sections,
        equations: originalStructuredData?.structured_elements?.equations || [],
        image_count: originalStructuredData?.structured_elements?.image_count || 0,
        table_count: originalStructuredData?.structured_elements?.table_count || 0,
        section_count: sections.length,
        equation_count: originalStructuredData?.structured_elements?.equation_count || 0
      },
      metadata: originalStructuredData?.metadata || {},
      raw_markdown: markdown
    };
    
    return updatedStructuredData;
  }

  function formatHeading(level: number, e?: React.MouseEvent) {
    console.log('[formatHeading] Called', { 
      level, 
      hasEvent: !!e, 
      flagBefore: headingButtonClickedRef.current,
      stackTrace: new Error().stack
    });
    
    // CRITICAL: Only proceed if this was explicitly called from a button click
    // Check if flag was already reset (meaning editor was clicked first)
    if (!headingButtonClickedRef.current && !e) {
      console.log('[formatHeading] No event and flag is false - this should not happen from button click, aborting');
      return;
    }
    
    // Set flag to indicate button was clicked
    headingButtonClickedRef.current = true;
    console.log('[formatHeading] Flag set to true');
    
    // Prevent event propagation to avoid accidental triggers
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[formatHeading] Event prevented and stopped');
    } else {
      console.warn('[formatHeading] WARNING: Called without event object! This might be an accidental trigger.');
    }
    
    if (!editorRef.current) {
      console.log('[formatHeading] No editor ref, returning');
      headingButtonClickedRef.current = false;
      return;
    }
    
    // Use requestAnimationFrame to ensure DOM is ready, but check flag immediately
    requestAnimationFrame(() => {
      console.log('[formatHeading] In requestAnimationFrame, flag:', headingButtonClickedRef.current);
      
      // Double-check flag is still set (button was actually clicked)
      // If flag was reset by editor click, abort immediately
      if (!headingButtonClickedRef.current) {
        console.log('[formatHeading] Flag is false in requestAnimationFrame - editor was clicked, aborting');
        return;
      }
      
      const selection = window.getSelection();
      if (!selection) {
        console.log('[formatHeading] No selection object');
        headingButtonClickedRef.current = false;
        return;
      }
      
      console.log('[formatHeading] Selection info', {
        rangeCount: selection.rangeCount,
        isCollapsed: selection.rangeCount > 0 ? selection.getRangeAt(0).collapsed : 'N/A'
      });
      
      // Only proceed if we have a valid selection within the editor
      if (selection.rangeCount === 0) {
        console.log('[formatHeading] No range in selection, aborting');
        headingButtonClickedRef.current = false;
        return;
      }
      
      const range = selection.getRangeAt(0);
      
      // Ensure range is within the editor
      if (!editorRef.current!.contains(range.commonAncestorContainer)) {
        console.log('[formatHeading] Range outside editor, aborting');
        headingButtonClickedRef.current = false;
        return;
      }
      
      const selectedText = range.toString().trim();
      console.log('[formatHeading] Selected text:', selectedText, 'length:', selectedText.length);
      
      const headingTag = `h${level}`;
      
      if (selectedText.length > 0) {
        console.log('[formatHeading] Wrapping selected text in heading');
        // Text is explicitly selected - wrap it in heading
        const headingElement = window.document.createElement(headingTag);
        headingElement.textContent = selectedText;
        range.deleteContents();
        range.insertNode(headingElement);
        
        // Move cursor after the heading
        range.setStartAfter(headingElement);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        editorRef.current.focus();
        handleEditorChange();
      } else {
        // CHANGED: Do NOT automatically convert blocks when no text is selected
        // This prevents accidental conversion when clicking text and then clicking button
        console.log('[formatHeading] No text selected - doing nothing. User must select text first.');
        console.log('[formatHeading] To convert a block to heading, user must select the text in that block first.');
        
        // Reset flag and return without doing anything
        headingButtonClickedRef.current = false;
        return;
      }
      
      // Reset flag after processing
      console.log('[formatHeading] Resetting flag to false');
      headingButtonClickedRef.current = false;
    });
  }

  function handleEditorChange() {
    if (editorRef.current) {
      setExtractedText(editorRef.current.innerHTML);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotification(null);
    
    if (!editorRef.current || !document) {
      console.error('Missing editorRef or document');
      return;
    }
    
    const htmlContent = editorRef.current.innerHTML;
    if (!htmlContent.trim()) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Document content cannot be empty.'
      });
      return;
    }
    
    setLoading(true);
    try {
      // Convert HTML to markdown
      const markdownContent = convertHTMLToMarkdown(htmlContent);
      console.log('Converted markdown length:', markdownContent.length);
      
      // Parse and update structured_data
      const updatedStructuredData = parseContentAndUpdateStructuredData(
        htmlContent,
        document.structured_data || {}
      );
      console.log('Updated structured_data:', {
        contentKeys: Object.keys(updatedStructuredData.content || {}),
        sectionOrder: updatedStructuredData.sectionOrder,
        sectionCount: updatedStructuredData.structured_elements?.section_count
      });
      
      const res = await fetch(`/api/admin/document/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          extracted_text: markdownContent,
          structured_data: updatedStructuredData
        })
      });
      
      const data: any = await res.json();
      console.log('Update response:', { status: res.status, data });
      
      if (res.ok && data.success) {
        setNotification({
          type: 'success',
          title: 'Success',
          message: data.message || 'Document updated successfully.'
        });
        setTimeout(() => {
          navigate('/admin/document');
        }, 1500);
      } else {
        const errorMessage = data.error || data.message || 'Failed to update document.';
        console.error('Update failed:', errorMessage, data);
        setNotification({
          type: 'error',
          title: 'Update Failed',
          message: errorMessage
        });
      }
    } catch (err: any) {
      console.error('Error updating document:', err);
      setNotification({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to update document.'
      });
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <Layout user={user}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 'calc(100vh - 200px)'
        }}>
          <Loading text="Loading" />
        </div>
      </Layout>
    );
  }

  if (!document) {
    return <div>Document not found</div>;
  }

  return (
    <Layout user={user}>
      <div className={styles.container}>
        <h1 className={styles.title}>Edit Document</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Document Name
            <input 
              className={styles.input} 
              value={document.display_name || document.group_name || document.original_name || document.file_name} 
              disabled 
              style={{ background: '#e9e9e9', cursor: 'not-allowed' }}
            />
          </label>
          
          <label className={styles.label}>
            Content Editor
            <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                tabIndex={-1}
                ref={(el) => {
                  if (el) {
                    // Prevent button from receiving focus
                    el.setAttribute('tabindex', '-1');
                    
                    // Log when button receives focus (shouldn't happen)
                    el.addEventListener('focus', () => {
                      console.error('[H1 Button] Received focus! Refocusing editor...', {
                        activeElement: window.document.activeElement,
                        stackTrace: new Error().stack?.split('\n').slice(0, 10).join('\n')
                      });
                      // Immediately refocus editor
                      if (editorRef.current) {
                        editorRef.current.focus();
                      }
                    }, { once: false });
                    
                    // Prevent keyboard events from being handled by button
                    el.addEventListener('keydown', (e) => {
                      console.error('[H1 Button] keydown event on button! Preventing and refocusing editor...', {
                        key: e.key,
                        code: e.code,
                        target: e.target,
                        activeElement: window.document.activeElement
                      });
                      e.preventDefault();
                      e.stopPropagation();
                      // Refocus editor and pass the key event
                      if (editorRef.current) {
                        editorRef.current.focus();
                        // Create a new keydown event for the editor
                        const editorEvent = new KeyboardEvent('keydown', {
                          key: e.key,
                          code: e.code,
                          bubbles: true,
                          cancelable: true
                        });
                        editorRef.current.dispatchEvent(editorEvent);
                      }
                    }, { once: false });
                  }
                }}
                onClick={(e) => {
                  console.log('[H1 Button] onClick triggered, target:', e.target);
                  // Set flag BEFORE calling formatHeading
                  headingButtonClickedRef.current = true;
                  console.log('[H1 Button] Flag set to true before formatHeading');
                  e.preventDefault();
                  e.stopPropagation();
                  formatHeading(1, e);
                  // Refocus editor after clicking button
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.focus();
                    }
                  }, 0);
                }}
                onMouseDown={(e) => {
                  console.log('[H1 Button] onMouseDown triggered');
                  // Set flag on mouseDown too, in case onClick doesn't fire
                  headingButtonClickedRef.current = true;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onFocus={(e) => {
                  console.error('[H1 Button] onFocus triggered! Refocusing editor...', {
                    relatedTarget: e.relatedTarget,
                    activeElement: window.document.activeElement,
                    stackTrace: new Error().stack?.split('\n').slice(0, 10).join('\n')
                  });
                  // Immediately refocus editor
                  e.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }}
                onKeyDown={(e) => {
                  console.error('[H1 Button] onKeyDown triggered! Preventing and refocusing editor...', {
                    key: e.key,
                    code: e.code,
                    target: e.target,
                    activeElement: window.document.activeElement,
                    stackTrace: new Error().stack?.split('\n').slice(0, 10).join('\n')
                  });
                  e.preventDefault();
                  e.stopPropagation();
                  // Refocus editor and pass the key event
                  if (editorRef.current) {
                    editorRef.current.focus();
                    // Create a new keydown event for the editor
                    const editorEvent = new KeyboardEvent('keydown', {
                      key: e.key,
                      code: e.code,
                      bubbles: true,
                      cancelable: true
                    });
                    editorRef.current.dispatchEvent(editorEvent);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  console.log('[H2 Button] onClick triggered, target:', e.target);
                  // Set flag BEFORE calling formatHeading
                  headingButtonClickedRef.current = true;
                  console.log('[H2 Button] Flag set to true before formatHeading');
                  e.preventDefault();
                  e.stopPropagation();
                  formatHeading(2, e);
                  // Refocus editor after clicking button
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.focus();
                    }
                  }, 0);
                }}
                onMouseDown={(e) => {
                  console.log('[H2 Button] onMouseDown triggered');
                  // Set flag on mouseDown too, in case onClick doesn't fire
                  headingButtonClickedRef.current = true;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onFocus={(e) => {
                  e.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }}
                onKeyDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editorRef.current) {
                    editorRef.current.focus();
                    const editorEvent = new KeyboardEvent('keydown', {
                      key: e.key,
                      code: e.code,
                      bubbles: true,
                      cancelable: true
                    });
                    editorRef.current.dispatchEvent(editorEvent);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  console.log('[H3 Button] onClick triggered, target:', e.target);
                  // Set flag BEFORE calling formatHeading
                  headingButtonClickedRef.current = true;
                  console.log('[H3 Button] Flag set to true before formatHeading');
                  e.preventDefault();
                  e.stopPropagation();
                  formatHeading(3, e);
                  // Refocus editor after clicking button
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.focus();
                    }
                  }, 0);
                }}
                onMouseDown={(e) => {
                  console.log('[H3 Button] onMouseDown triggered');
                  // Set flag on mouseDown too, in case onClick doesn't fire
                  headingButtonClickedRef.current = true;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onFocus={(e) => {
                  e.preventDefault();
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }}
                onKeyDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editorRef.current) {
                    editorRef.current.focus();
                    const editorEvent = new KeyboardEvent('keydown', {
                      key: e.key,
                      code: e.code,
                      bubbles: true,
                      cancelable: true
                    });
                    editorRef.current.dispatchEvent(editorEvent);
                  }
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
                title="Heading 3"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => {
                  window.document.execCommand('bold', false);
                  editorRef.current?.focus();
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                title="Bold"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => {
                  window.document.execCommand('italic', false);
                  editorRef.current?.focus();
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer',
                  fontStyle: 'italic'
                }}
                title="Italic"
              >
                I
              </button>
            </div>
            <style>{`
              [data-editor-content] h1 {
                font-size: 2em;
                font-weight: bold;
                margin: 0.67em 0;
                line-height: 1.2;
                color: #1a1a1a;
              }
              [data-editor-content] h2 {
                font-size: 1.5em;
                font-weight: bold;
                margin: 0.75em 0;
                line-height: 1.3;
                color: #2a2a2a;
              }
              [data-editor-content] h3 {
                font-size: 1.17em;
                font-weight: bold;
                margin: 0.83em 0;
                line-height: 1.4;
                color: #3a3a3a;
              }
              [data-editor-content] p {
                margin: 0.5em 0;
                line-height: 1.6;
              }
              [data-editor-content] strong,
              [data-editor-content] b {
                font-weight: bold;
              }
              [data-editor-content] em,
              [data-editor-content] i {
                font-style: italic;
              }
            `}</style>
            <div
              ref={(el) => {
                if (el && editorRef) {
                  (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                  
                  // Log focus events
                  el.addEventListener('focus', () => {
                    console.log('[Editor] Received focus', {
                      activeElement: window.document.activeElement,
                      timestamp: Date.now()
                    });
                  }, { once: false });
                  
                  el.addEventListener('blur', (e) => {
                    console.log('[Editor] Lost focus', {
                      relatedTarget: e.relatedTarget,
                      activeElement: window.document.activeElement,
                      timestamp: Date.now()
                    });
                  }, { once: false });
                }
              }}
              data-editor-content
              contentEditable
              onInput={handleEditorChange}
              onFocus={(e) => {
                console.log('[Editor] onFocus triggered', {
                  relatedTarget: e.relatedTarget,
                  activeElement: window.document.activeElement
                });
              }}
              onBlur={(e) => {
                console.log('[Editor] onBlur triggered', {
                  relatedTarget: e.relatedTarget,
                  activeElement: window.document.activeElement,
                  timestamp: Date.now()
                });
              }}
              onClick={(e) => {
                // Check if the click target is actually a button or button child
                const target = e.target as HTMLElement;
                const isButton = target.tagName === 'BUTTON' || target.closest('button');
                
                if (isButton) {
                  console.log('[Editor onClick] Click is on button, NOT resetting flag');
                  return; // Don't reset if clicking a button
                }
                
                // Reset flag when clicking in editor (not on button)
                console.log('[Editor onClick] Resetting flag, current flag:', headingButtonClickedRef.current, 'target:', e.target);
                headingButtonClickedRef.current = false;
                // Check if formatHeading is somehow in the call stack
                const stack = new Error().stack;
                if (stack && stack.includes('formatHeading')) {
                  console.error('[Editor onClick] WARNING: formatHeading found in call stack!');
                }
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Check if the click target is actually a button or button child
                const target = e.target as HTMLElement;
                const isButton = target.tagName === 'BUTTON' || target.closest('button');
                
                if (isButton) {
                  console.log('[Editor onMouseDown] Click is on button, NOT resetting flag');
                  return; // Don't reset if clicking a button
                }
                
                // Reset flag when mouse down in editor (not on button)
                // Use immediate execution to reset flag BEFORE any other handlers
                console.log('[Editor onMouseDown] Resetting flag IMMEDIATELY, current flag:', headingButtonClickedRef.current, 'target:', e.target);
                headingButtonClickedRef.current = false;
                e.stopPropagation();
                // Don't preventDefault here as it might interfere with contentEditable
              }}
              onKeyDown={(e) => {
                // Prevent any accidental formatting on key press
                console.log('[Editor onKeyDown] Key pressed:', {
                  key: e.key,
                  code: e.code,
                  target: e.target,
                  currentTarget: e.currentTarget,
                  activeElement: window.document.activeElement,
                  flag: headingButtonClickedRef.current,
                  defaultPrevented: e.defaultPrevented,
                  stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
                });
                
                headingButtonClickedRef.current = false;
                
                // Check if focus is being stolen - if so, refocus editor
                if (window.document.activeElement !== editorRef.current && 
                    window.document.activeElement !== e.currentTarget) {
                  console.warn('[Editor onKeyDown] WARNING: Focus is not on editor! Active element:', window.document.activeElement, 'Refocusing...');
                  // Ensure editor has focus
                  if (editorRef.current) {
                    editorRef.current.focus();
                  }
                }
                
                // Ensure editor maintains focus
                if (editorRef.current && window.document.activeElement !== editorRef.current) {
                  editorRef.current.focus();
                }
                
                // Handle Enter key to create new paragraphs (like Word/Docs)
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const selection = window.getSelection();
                  if (!selection || selection.rangeCount === 0) return;
                  
                  const range = selection.getRangeAt(0);
                  
                  if (!editorRef.current!.contains(range.commonAncestorContainer)) {
                    return;
                  }
                  
                  // Find the current block element
                  let currentBlock: HTMLElement | null = null;
                  let node: Node | null = range.commonAncestorContainer;
                  
                  // Walk up to find block element
                  while (node && node !== editorRef.current) {
                    if (node instanceof HTMLElement) {
                      const tagName = node.tagName;
                      if (tagName === 'P' || tagName.match(/^H[1-6]$/) || tagName === 'DIV') {
                        currentBlock = node;
                        break;
                      }
                    }
                    node = node.parentNode;
                  }
                  
                  // Create a new paragraph
                  const newP = window.document.createElement('p');
                  newP.innerHTML = '<br>'; // Empty paragraph with line break
                  
                  if (currentBlock && currentBlock !== editorRef.current) {
                    // If we're at the end of the block, insert after it
                    const blockRange = window.document.createRange();
                    blockRange.selectNodeContents(currentBlock);
                    blockRange.collapse(false); // End of block
                    
                    if (range.compareBoundaryPoints(Range.START_TO_START, blockRange) >= 0) {
                      // Cursor is at or near end of block - insert after
                      if (currentBlock.nextSibling) {
                        editorRef.current!.insertBefore(newP, currentBlock.nextSibling);
                      } else {
                        editorRef.current!.appendChild(newP);
                      }
                    } else {
                      // Cursor is in middle - split the block
                      const afterContent = range.extractContents();
                      newP.appendChild(afterContent);
                      
                      if (currentBlock.nextSibling) {
                        editorRef.current!.insertBefore(newP, currentBlock.nextSibling);
                      } else {
                        editorRef.current!.appendChild(newP);
                      }
                    }
                  } else {
                    // No block found, insert at cursor
                    range.insertNode(newP);
                  }
                  
                  // Move cursor to new paragraph
                  const newRange = window.document.createRange();
                  newRange.selectNodeContents(newP);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  
                  handleEditorChange();
                  return;
                }
                
                e.stopPropagation();
              }}
              style={{
                width: '100%',
                minHeight: '300px',
                maxHeight: '50vh',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '16px',
                background: '#f5f5f5',
                fontSize: '1rem',
                outline: 'none',
                fontFamily: 'Poppins, sans-serif',
                lineHeight: '1.6',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
              suppressContentEditableWarning
            />
          </label>
          
          <div className={styles.buttonWrapper}>
            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              type="button" 
              className={styles.deleteBtn} 
              onClick={() => navigate('/admin/document')}
            >
              Cancel
            </button>
          </div>
        </form>

        {notification && (
          <NotificationCard
            type={notification.type}
            title={notification.title}
            message={notification.message}
            primaryButtonText="OK"
            onPrimaryClick={() => setNotification(null)}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </Layout>
  );
}
