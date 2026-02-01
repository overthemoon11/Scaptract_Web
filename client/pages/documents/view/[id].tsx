import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SessionStatus from '@/components/SessionStatus';
import styles from '@/styles/DocumentViewer.module.css';
import { User } from '@shared/types';
import Loading from '@/components/Loading';
import { MemoizedMarkdown } from '@/uicomponents/chat/memoized-markdown';

interface DocumentViewData {
  id: string;
  original_name: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  status: string;
  page_count?: number;
  group_name?: string | null;
  display_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface RelatedImage {
  id: string;
  original_name: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size?: number;
  created_at?: string;
}

interface ExtractionResultData {
  id: string;
  extracted_text?: string | null;
  structured_data?: any;
  accuracy?: number;
  processing_time_ms?: number;
  status: string;
  created_at?: string;
}

interface CommentData {
  id: string;
  content: string;
  reply?: string | null;
  document_id: string;
  user_id: string;
  user_name: string;
  created_at?: string;
}

export default function ViewDocumentPage() {
  const { id, group_name } = useParams<{ id?: string; group_name?: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [document, setDocument] = useState<DocumentViewData | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResultData | null>(null);
  const [isGroupView, setIsGroupView] = useState(false);
  const [groupDocuments, setGroupDocuments] = useState<DocumentViewData[]>([]);
  const [activeTab, setActiveTab] = useState<'text' | 'data'>('text');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editableText, setEditableText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textContentRef = useRef<HTMLDivElement>(null);
  const [relatedImages, setRelatedImages] = useState<RelatedImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageCarousel, setShowImageCarousel] = useState(false);
  const [showOriginalCarousel, setShowOriginalCarousel] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragSourceRef = useRef<number | null>(null);
  const [summarizingSection, setSummarizingSection] = useState<string | null>(null);
  const [sectionSummaries, setSectionSummaries] = useState<Record<string, string>>({});
  const [hiddenSummaries, setHiddenSummaries] = useState<Set<string>>(new Set());
  const [ocrMarkdown, setOcrMarkdown] = useState<string | null>(null);
  const [loadingOcrMarkdown, setLoadingOcrMarkdown] = useState(false);
  const [convertingMarkdown, setConvertingMarkdown] = useState(false);

  // Reset to page 1 when switching tabs
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Convert markdown to JSON when switching to Structured Data tab if structured_data doesn't exist
  useEffect(() => {
    async function convertMarkdownIfNeeded() {
      // Only run when switching to 'data' tab
      if (activeTab !== 'data') return;
      
      // Check if structured_data exists and has content
      if (extractionResult?.structured_data) {
        const hasContent = typeof extractionResult.structured_data === 'object' && 
          Object.keys(extractionResult.structured_data).length > 0 &&
          // Also check if content object has actual sections (not just metadata)
          (extractionResult.structured_data.content || 
           Object.keys(extractionResult.structured_data).some(key => 
             key !== 'metadata' && key !== 'structured_elements' && key !== 'sectionOrder'
           ));
        
        if (hasContent) {
          // Structured data already exists with content, no need to convert
          console.log('[View] Structured data already exists, skipping conversion');
          return;
        }
      }

      // For group views, check if we have a group_name
      if (isGroupView) {
        const groupNameToUse = document?.group_name || (group_name ? decodeURIComponent(group_name) : null);
        console.log('[View] Group view detected:', { isGroupView, documentGroupName: document?.group_name, routeGroupName: group_name, groupNameToUse });
        
        if (!groupNameToUse) {
          console.log('[View] No group_name available for group view, skipping conversion');
          return;
        }

        console.log('[View] Converting markdown to JSON for group:', groupNameToUse);
        setConvertingMarkdown(true);

        try {
          const groupName = encodeURIComponent(groupNameToUse);
          const response = await fetch(`/api/documents/convert-markdown-to-json/group?group_name=${groupName}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('[View] Error converting markdown for group:', errorData);
            return;
          }

          const result = await response.json();
          console.log('[View] Successfully converted markdown to JSON for group');

          // Reload group data
          try {
            const groupRes = await fetch(`/api/documents/group/${encodeURIComponent(groupNameToUse)}`, { 
              credentials: 'include' 
            });
            if (groupRes.ok) {
              const groupData = await groupRes.json();
              if (groupData.combinedExtractionResult) {
                setExtractionResult({
                  id: 'group-combined',
                  extracted_text: groupData.combinedExtractionResult.extracted_text || '',
                  structured_data: groupData.combinedExtractionResult.structured_data || {},
                  accuracy: groupData.combinedExtractionResult.accuracy || 0,
                  processing_time_ms: groupData.combinedExtractionResult.processing_time_ms || 0,
                  status: groupData.combinedExtractionResult.status || 'completed',
                  created_at: undefined
                });
              }
            }
          } catch (reloadError) {
            console.error('[View] Error reloading group data:', reloadError);
            // Fallback: update with result from conversion
            if (result.structured_data) {
              setExtractionResult(prev => prev ? {
                ...prev,
                structured_data: result.structured_data
              } : null);
            }
          }

        } catch (error: any) {
          console.error('[View] Error converting markdown to JSON for group:', error);
        } finally {
          setConvertingMarkdown(false);
        }
        return; // Exit early for group views
      }

      // Handle individual document views
      if (!extractionResult?.id || extractionResult.id === 'group-combined') {
        setConvertingMarkdown(false);
        return;
      }

      // Check if extraction result status is completed (for individual views)
      if (extractionResult.status !== 'completed') {
        console.log('[View] Extraction result not completed, skipping conversion');
        return;
      }

      console.log('[View] Converting markdown to JSON for extraction result:', extractionResult.id);
      setConvertingMarkdown(true);

      try {
        const response = await fetch(`/api/documents/convert-markdown-to-json/${extractionResult.id}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[View] Error converting markdown:', errorData);
          // Don't show error to user, just log it
          return;
        }

        const result = await response.json();
        console.log('[View] Successfully converted markdown to JSON');

        // Reload individual document data
        if (id) {
          try {
            const extractRes = await fetch(`/api/documents/extract/${id}`, { credentials: 'include' });
            if (extractRes.ok) {
              const extractData = await extractRes.json();
              if (extractData.extractionResult) {
                setExtractionResult(extractData.extractionResult);
              }
            }
          } catch (reloadError) {
            console.error('[View] Error reloading extraction result:', reloadError);
            // Fallback: update with result from conversion
            if (result.structured_data) {
              setExtractionResult(prev => prev ? {
                ...prev,
                structured_data: result.structured_data
              } : null);
            }
          }
        } else {
          // Fallback: update with result from conversion
          if (result.structured_data) {
            setExtractionResult(prev => prev ? {
              ...prev,
              structured_data: result.structured_data
            } : null);
          }
        }

      } catch (error: any) {
        console.error('[View] Error converting markdown to JSON:', error);
        // Don't show error to user, just log it
      } finally {
        setConvertingMarkdown(false);
      }
    }

    convertMarkdownIfNeeded();
  }, [activeTab, extractionResult, isGroupView, document, group_name, id]);

  // Load document and extraction result
  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        // Check if this is a group view (from route param) or regular document view
        if (group_name) {
          // Group view route: /documents/view/group/:group_name
          const groupName = decodeURIComponent(group_name);
          setIsGroupView(true);
            
            try {
              // Fetch group data
              const groupRes = await fetch(`/api/documents/group/${encodeURIComponent(groupName)}`, { credentials: 'include' });
              
              if (!groupRes.ok) {
                console.error('Failed to fetch group data:', groupRes.status, groupRes.statusText);
                const errorData = await groupRes.json().catch(() => ({}));
                console.error('Error details:', errorData);
                setLoading(false);
                return;
              }
              
              const groupData = await groupRes.json();
              console.log('Group data received:', groupData);
              
              if (groupData.success && groupData.documents && groupData.documents.length > 0) {
                // Use first document as the "main" document for display
                setDocument(groupData.documents[0]);
                setGroupDocuments(groupData.documents);
                
                // Populate relatedImages from groupDocuments for carousel functionality
                const groupRelatedImages: RelatedImage[] = groupData.documents.map((doc: DocumentViewData) => ({
                  id: doc.id,
                  original_name: doc.original_name,
                  file_name: doc.file_name,
                  file_path: doc.file_path,
                  mime_type: doc.mime_type
                }));
                setRelatedImages(groupRelatedImages);
                setCurrentImageIndex(0);
                
                // Use combined extraction result (always set, even if empty)
                setExtractionResult({
                  id: 'group-combined',
                  extracted_text: groupData.combinedExtractionResult?.extracted_text || '',
                  structured_data: groupData.combinedExtractionResult?.structured_data || {},
                  accuracy: groupData.combinedExtractionResult?.accuracy || 0,
                  processing_time_ms: groupData.combinedExtractionResult?.processing_time_ms || 0,
                  status: groupData.combinedExtractionResult?.status || 'processing',
                  created_at: undefined
                });
              } else {
                console.error('No documents found in group or invalid response:', groupData);
                // Still set document and empty extraction result so page can render
                if (groupData.documents && groupData.documents.length > 0) {
                  setDocument(groupData.documents[0]);
                  setGroupDocuments(groupData.documents);
                  
                  // Populate relatedImages from groupDocuments for carousel functionality
                  const groupRelatedImages: RelatedImage[] = groupData.documents.map((doc: DocumentViewData) => ({
                    id: doc.id,
                    original_name: doc.original_name,
                    file_name: doc.file_name,
                    file_path: doc.file_path,
                    mime_type: doc.mime_type
                  }));
                  setRelatedImages(groupRelatedImages);
                  setCurrentImageIndex(0);
                  
                  setExtractionResult({
                    id: 'group-combined',
                    extracted_text: '',
                    structured_data: {},
                    accuracy: 0,
                    processing_time_ms: 0,
                    status: 'processing',
                    created_at: undefined
                  });
                }
              }
            } catch (err) {
              console.error('Error fetching group data:', err);
            }
        } else if (id) {
          // Regular document view route: /documents/view/:id
          setIsGroupView(false);
          const extractRes = await fetch(`/api/documents/extract/${id}`, { credentials: 'include' });
            const extractData = await extractRes.json();
            
            if (extractData.document) {
              console.log('[View] Document loaded:', { id: extractData.document.id, group_name: extractData.document.group_name });
              setDocument(extractData.document);
              // Always fetch related images if this is an image document
              if (extractData.document.mime_type && extractData.document.mime_type.startsWith('image/')) {
                if (extractData.relatedImages && extractData.relatedImages.length > 0) {
                  setRelatedImages(extractData.relatedImages);
                  // Find current image index
                  const currentIndex = extractData.relatedImages.findIndex((img: RelatedImage) => img.id === id);
                  setCurrentImageIndex(currentIndex >= 0 ? currentIndex : 0);
                } else {
                  // If no related images returned but it's an image, create a single-item array
                  setRelatedImages([{
                    id: extractData.document.id,
                    original_name: extractData.document.original_name,
                    file_name: extractData.document.file_name,
                    file_path: extractData.document.file_path,
                    mime_type: extractData.document.mime_type
                  }]);
                  setCurrentImageIndex(0);
                }
              }
            }
            if (extractData.extractionResult) {
              setExtractionResult(extractData.extractionResult);
            }
        } else {
          console.error('No id or group_name provided in route');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, group_name]);

  // Load comments (only for individual document views, not group views)
  useEffect(() => {
    if (id && !group_name) {
      loadComments();
    }
  }, [id]);

  // Load OCR markdown files when document is loaded
  useEffect(() => {
    async function loadOcrMarkdown() {
      // For group views, use group_name from route; for individual views, use document.group_name
      const groupNameToUse = group_name ? decodeURIComponent(group_name) : document?.group_name;
      
      if (!groupNameToUse) {
        console.log('[OCR] No group_name found. Route group_name:', group_name, 'Document group_name:', document?.group_name);
        return;
      }
      
      // For group views, always use OCR markdown API (has correct image paths with subdirectories)
      // For individual views, prefer extracted_text from database but fallback to OCR markdown API
      if (isGroupView) {
        console.log('[OCR] Group view detected, loading markdown from files for group:', groupNameToUse);
        setLoadingOcrMarkdown(true);
      } else if (extractionResult?.extracted_text) {
        console.log('[OCR] Using extracted_text from database (', extractionResult.extracted_text.length, 'chars)');
        setOcrMarkdown(null); // Don't load from files if we have it in DB
        setLoadingOcrMarkdown(false);
        return;
      } else {
        console.log('[OCR] No extracted_text in database, loading markdown from files for group:', groupNameToUse);
        setLoadingOcrMarkdown(true);
      }
      try {
        const url = `/api/documents/ocr-markdown/${encodeURIComponent(groupNameToUse)}`;
        console.log('[OCR] Fetching from:', url);
        const response = await fetch(url, {
          credentials: 'include'
        });
        console.log('[OCR] Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[OCR] Response data:', { success: data.success, hasMarkdown: !!data.combinedMarkdown, markdownLength: data.combinedMarkdown?.length });
          if (data.success && data.combinedMarkdown) {
            setOcrMarkdown(data.combinedMarkdown);
          } else {
            console.log('[OCR] No markdown content in response');
            setOcrMarkdown(null);
          }
        } else {
          const errorText = await response.text();
          console.error('[OCR] API error:', response.status, errorText);
          setOcrMarkdown(null);
        }
      } catch (error) {
        console.error('[OCR] Error loading OCR markdown:', error);
        setOcrMarkdown(null);
      } finally {
        setLoadingOcrMarkdown(false);
      }
    }
    
    loadOcrMarkdown();
  }, [group_name, document?.group_name, isGroupView, extractionResult?.extracted_text]);

  const loadComments = async () => {
    if (!id) return;
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/documents/comments/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setComments(data.comments || []);
        }
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/documents/comments/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newComment.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setComments([data.comment, ...comments]);
          setNewComment('');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Render markdown with bold headers (# symbols)
  const renderMarkdownWithBold = (text: string | null | undefined) => {
    if (!text) return null;

    // Split by lines and process each line
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Check if line starts with # (markdown header)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        const headerLevel = headerMatch[1].length; // Number of # symbols
        const headerText = headerMatch[2];
        
        // Apply search highlighting if needed
        let headerContent: React.ReactNode = headerText;
        if (searchTerm.trim()) {
          const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          const parts = headerText.split(regex);
          headerContent = parts.map((part, partIndex) =>
            regex.test(part) ? (
              <mark key={partIndex} style={{ backgroundColor: '#ffeb3b', padding: '2px 0' }}>
                {part}
              </mark>
            ) : part
          );
        }
        
        // Render header with appropriate bold styling
        const headerStyle: React.CSSProperties = {
          fontWeight: 'bold',
          fontSize: headerLevel === 1 ? '1.5em' : headerLevel === 2 ? '1.3em' : headerLevel === 3 ? '1.1em' : '1em',
          marginTop: lineIndex > 0 ? '1em' : '0',
          marginBottom: '0.5em'
        };
        
        elements.push(
          <div key={lineIndex} style={headerStyle}>
            {headerContent}
          </div>
        );
      } else {
        // Regular text line
        let lineContent: React.ReactNode = line;
        
        // Apply search highlighting if needed
        if (searchTerm.trim()) {
          const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          const parts = line.split(regex);
          lineContent = parts.map((part, partIndex) =>
            regex.test(part) ? (
              <mark key={partIndex} style={{ backgroundColor: '#ffeb3b', padding: '2px 0' }}>
                {part}
              </mark>
            ) : part
          );
        }
        
        elements.push(
          <div key={lineIndex} style={{ marginBottom: '0.5em' }}>
            {lineContent}
          </div>
        );
      }
    });

    return <>{elements}</>;
  };

  // Search functionality - searches in both extracted_text and structured_data
  const highlightSearchTerm = (text: string | null | undefined) => {
    // This function is kept for backward compatibility but renderMarkdownWithBold is used instead
    if (!searchTerm.trim() || !text) return text;
    return renderMarkdownWithBold(text);
  };

  // Helper function to remove \n from text
  const removeNewlines = (text: string): string => {
    if (!text) return '';
    return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Parse and merge JSON chunks into structured object
  // This must be defined before structuredData since structuredData depends on it
  const structuredExtraction = useMemo(() => {
    if (!extractionResult?.extracted_text) return null;
    
    const rawText = extractionResult.extracted_text.trim();
    
    try {
      const chunks: any[] = [];
      
      // Method 1: Split by }{ pattern (most common for concatenated JSON)
      if (rawText.includes('}{')) {
        const parts = rawText.split('}{');
        for (let i = 0; i < parts.length; i++) {
          let jsonStr = parts[i];
          if (i > 0) jsonStr = '{' + jsonStr;
          if (i < parts.length - 1) jsonStr = jsonStr + '}';
          
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.extraction || parsed.status) {
              chunks.push(parsed);
            }
          } catch (e) {
            // Skip invalid chunks
          }
        }
      } else {
        // Method 2: Try to parse as single JSON
        try {
          const parsed = JSON.parse(rawText);
          if (parsed.extraction || parsed.status) {
            chunks.push(parsed);
          } else {
            return null;
          }
        } catch (e) {
          // Try manual parsing by finding complete JSON objects
          let currentChunk = '';
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < rawText.length; i++) {
            const char = rawText[i];
            
            if (escapeNext) {
              escapeNext = false;
              currentChunk += char;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              currentChunk += char;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              currentChunk += char;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                if (braceCount === 0) currentChunk = '';
                braceCount++;
                currentChunk += char;
              } else if (char === '}') {
                braceCount--;
                currentChunk += char;
                
                if (braceCount === 0 && currentChunk.trim()) {
                  try {
                    const parsed = JSON.parse(currentChunk);
                    if (parsed.extraction || parsed.status) {
                      chunks.push(parsed);
                    }
                  } catch (e) {
                    // Skip invalid chunks
                  }
                  currentChunk = '';
                }
              } else {
                currentChunk += char;
              }
            } else {
              currentChunk += char;
            }
          }
        }
      }
      
      if (chunks.length === 0) {
        return null;
      }
      
      // Merge all chunks into final extraction
      const mergedExtraction: any = {
        title: '',
        authors: '',
        abstract: '',
        introduction: '',
        topics: [],
        conclusion: '',
        references: ''
      };
      
      // Track the last topic and subtopic across all chunks to merge content without titles
      let lastTopic: any = null;
      let lastSubtopic: any = null;
      
      for (const chunk of chunks) {
        if (chunk.extraction) {
          const ext = chunk.extraction;
          
          // Merge title (take the last non-empty one)
          if (ext.title && ext.title.trim()) {
            mergedExtraction.title = removeNewlines(ext.title.trim());
          }
          
          // Merge authors (combine into string)
          if (Array.isArray(ext.authors) && ext.authors.length > 0) {
            const authorsList = ext.authors.filter((a: any) => a && a.trim()).map((a: any) => removeNewlines(a.trim()));
            if (authorsList.length > 0) {
              mergedExtraction.authors = authorsList.join(', ');
            }
          }
          
          // Merge abstract (accumulate all parts)
          if (ext.abstract && ext.abstract.trim()) {
            const newAbstract = removeNewlines(ext.abstract.trim());
            if (!mergedExtraction.abstract) {
              mergedExtraction.abstract = newAbstract;
            } else {
              const oldIncludesNew = mergedExtraction.abstract.includes(newAbstract);
              const newIncludesOld = newAbstract.includes(mergedExtraction.abstract);
              
              if (newIncludesOld && !oldIncludesNew) {
                mergedExtraction.abstract = newAbstract;
              } else if (!oldIncludesNew && !newIncludesOld) {
                // Different parts - merge with space
                mergedExtraction.abstract += ' ' + newAbstract;
              }
            }
          }
          
          // Merge introduction (accumulate all parts)
          if (ext.introduction && ext.introduction.trim()) {
            const newIntro = removeNewlines(ext.introduction.trim());
            if (!mergedExtraction.introduction) {
              mergedExtraction.introduction = newIntro;
            } else {
              const oldIncludesNew = mergedExtraction.introduction.includes(newIntro);
              const newIncludesOld = newIntro.includes(mergedExtraction.introduction);
              
              if (newIncludesOld && !oldIncludesNew) {
                mergedExtraction.introduction = newIntro;
              } else if (!oldIncludesNew && !newIncludesOld) {
                mergedExtraction.introduction += ' ' + newIntro;
              }
            }
          }
          
          // Merge topics
          if (Array.isArray(ext.topics) && ext.topics.length > 0) {
            for (const topic of ext.topics) {
              let currentTopic: any = null;
              let hasContent = false;
              
              // Check if topic has any content (in subtopics or directly)
              if (Array.isArray(topic.subtopics) && topic.subtopics.length > 0) {
                hasContent = topic.subtopics.some((st: any) => st.content && st.content.trim());
              }
              if (topic.content && topic.content.trim()) {
                hasContent = true;
              }
              
              // If topic has a title, find or create it
              if (topic.topic_title && topic.topic_title.trim()) {
                const topicTitle = removeNewlines(topic.topic_title.trim());
                
                // Try exact match first
                currentTopic = mergedExtraction.topics.find((t: any) => 
                  t.topic_title === topicTitle
                );
                
                // If no exact match, try fuzzy matching for similar topics
                // (e.g., "Communicative Language Teaching (CLT)" vs "Communicative Language Teaching or CLT")
                if (!currentTopic) {
                  // Normalize titles for comparison (remove parentheses, "or", etc.)
                  const normalizeTitle = (title: string) => {
                    return title
                      .toLowerCase()
                      .replace(/\s*\([^)]*\)/g, '') // Remove parentheses and content
                      .replace(/\s+or\s+/gi, ' ') // Remove "or"
                      .replace(/\s+/g, ' ') // Normalize spaces
                      .trim();
                  };
                  
                  const normalizedNewTitle = normalizeTitle(topicTitle);
                  currentTopic = mergedExtraction.topics.find((t: any) => {
                    if (!t.topic_title) return false;
                    const normalizedExistingTitle = normalizeTitle(t.topic_title);
                    // Check if they're similar (one contains the other or they share significant words)
                    return normalizedExistingTitle === normalizedNewTitle ||
                           (normalizedNewTitle.length > 10 && normalizedExistingTitle.includes(normalizedNewTitle)) ||
                           (normalizedExistingTitle.length > 10 && normalizedNewTitle.includes(normalizedExistingTitle));
                  });
                  
                  // If found similar topic, update its title to the longer/more complete one
                  if (currentTopic) {
                    if (topicTitle.length > currentTopic.topic_title.length) {
                      currentTopic.topic_title = topicTitle;
                    }
                    // Preserve lastSubtopic if it belongs to this topic, otherwise use the last subtopic of this topic
                    if (lastSubtopic && currentTopic.subtopics.includes(lastSubtopic)) {
                      // Keep lastSubtopic - it belongs to this topic
                    } else if (currentTopic.subtopics.length > 0) {
                      // Use the last subtopic of this topic (which should have the content from previous chunks)
                      lastSubtopic = currentTopic.subtopics[currentTopic.subtopics.length - 1];
                    } else {
                      lastSubtopic = null;
                    }
                  }
                }
                
                if (!currentTopic) {
                  // New topic - create it
                  currentTopic = {
                    topic_title: topicTitle,
                    subtopics: []
                  };
                  mergedExtraction.topics.push(currentTopic);
                  lastSubtopic = null; // Reset last subtopic when creating a new topic
                } else {
                  // Found existing topic (exact or fuzzy match) - ensure lastSubtopic points to a subtopic in this topic
                  // This is critical: we want to merge new content into the existing subtopic from previous chunks
                  if (currentTopic.subtopics.length > 0) {
                    // Use the last subtopic of this topic (which should have content from previous chunks)
                    lastSubtopic = currentTopic.subtopics[currentTopic.subtopics.length - 1];
                  } else {
                    lastSubtopic = null;
                  }
                }
                lastTopic = currentTopic;
              } else if (hasContent) {
                // No topic title but has content - use the last topic if available
                if (lastTopic) {
                  currentTopic = lastTopic;
                } else if (mergedExtraction.topics.length > 0) {
                  // Use the last topic in the array
                  currentTopic = mergedExtraction.topics[mergedExtraction.topics.length - 1];
                  lastTopic = currentTopic;
                } else {
                  // No topics yet - create one without title
                  currentTopic = {
                    topic_title: '',
                    subtopics: []
                  };
                  mergedExtraction.topics.push(currentTopic);
                  lastTopic = currentTopic;
                }
              }
              
              // Process subtopics if we have a topic to attach them to
              if (currentTopic && Array.isArray(topic.subtopics)) {
                for (const subtopic of topic.subtopics) {
                  // Skip empty subtopics
                  if (!subtopic.content || !subtopic.content.trim()) {
                    continue;
                  }
                  
                  let currentSubtopic: any = null;
                  
                  // If subtopic has a title, find or create it
                  if (subtopic.subtopic_title && subtopic.subtopic_title.trim()) {
                    const subtopicTitle = removeNewlines(subtopic.subtopic_title.trim());
                    currentSubtopic = currentTopic.subtopics.find((s: any) =>
                      s.subtopic_title === subtopicTitle
                    );
                    
                    if (!currentSubtopic) {
                      currentSubtopic = {
                        subtopic_title: subtopicTitle,
                        content: ''
                      };
                      currentTopic.subtopics.push(currentSubtopic);
                    }
                    lastSubtopic = currentSubtopic;
                  } else {
                    // No subtopic title - use the last subtopic or create one
                    // Check if lastSubtopic belongs to currentTopic
                    if (lastSubtopic && currentTopic.subtopics.includes(lastSubtopic)) {
                      currentSubtopic = lastSubtopic;
                    } else {
                      // Last subtopic is from different topic or doesn't exist, use last subtopic of current topic
                      if (currentTopic.subtopics.length > 0) {
                        currentSubtopic = currentTopic.subtopics[currentTopic.subtopics.length - 1];
                        lastSubtopic = currentSubtopic;
                      } else {
                        // No subtopics yet - create one without title
                        currentSubtopic = {
                          subtopic_title: '',
                          content: ''
                        };
                        currentTopic.subtopics.push(currentSubtopic);
                        lastSubtopic = currentSubtopic;
                      }
                    }
                  }
                  
                  // Merge content into the current subtopic
                  if (currentSubtopic) {
                    const newContent = removeNewlines(subtopic.content.trim());
                    if (!currentSubtopic.content) {
                      currentSubtopic.content = newContent;
                    } else {
                      const oldIncludesNew = currentSubtopic.content.includes(newContent);
                      const newIncludesOld = newContent.includes(currentSubtopic.content);
                      
                      if (newIncludesOld && !oldIncludesNew) {
                        // New content contains old - replace (it's an update)
                        currentSubtopic.content = newContent;
                      } else if (oldIncludesNew && !newIncludesOld) {
                        // Old content contains new - keep old (it's already complete)
                        // Do nothing
                      } else {
                        // Neither contains the other - they're different parts, always merge them
                        // Check if it looks like a continuation (old ends with incomplete word)
                        const lastChar = currentSubtopic.content.slice(-1);
                        const firstChar = newContent[0] || '';
                        
                        // If old doesn't end with punctuation and new starts with lowercase, likely continuation
                        if (!['.', '!', '?', ' '].includes(lastChar) && firstChar && firstChar === firstChar.toLowerCase()) {
                          // Continuation - merge without space
                          currentSubtopic.content += newContent;
                        } else {
                          // Different sentences/paragraphs - merge with space
                          currentSubtopic.content += ' ' + newContent;
                        }
                      }
                    }
                  }
                }
              } else if (currentTopic && topic.content && topic.content.trim()) {
                // Topic has content but no subtopics - create a subtopic without title
                if (currentTopic.subtopics.length === 0) {
                  const newSubtopic = {
                    subtopic_title: '',
                    content: removeNewlines(topic.content.trim())
                  };
                  currentTopic.subtopics.push(newSubtopic);
                  lastSubtopic = newSubtopic;
                } else {
                  // Append to last subtopic or first subtopic
                  const targetSubtopic = lastSubtopic || currentTopic.subtopics[currentTopic.subtopics.length - 1];
                  const newContent = removeNewlines(topic.content.trim());
                  if (!targetSubtopic.content) {
                    targetSubtopic.content = newContent;
                  } else {
                    const oldIncludesNew = targetSubtopic.content.includes(newContent);
                    const newIncludesOld = newContent.includes(targetSubtopic.content);
                    
                    if (newIncludesOld && !oldIncludesNew) {
                      targetSubtopic.content = newContent;
                    } else if (!oldIncludesNew && !newIncludesOld) {
                      targetSubtopic.content += ' ' + newContent;
                    }
                  }
                }
              }
            }
          }
          
          // Merge conclusion
          if (ext.conclusion && ext.conclusion.trim()) {
            const newConclusion = removeNewlines(ext.conclusion.trim());
            if (!mergedExtraction.conclusion) {
              mergedExtraction.conclusion = newConclusion;
            } else {
              const oldIncludesNew = mergedExtraction.conclusion.includes(newConclusion);
              const newIncludesOld = newConclusion.includes(mergedExtraction.conclusion);
              
              if (newIncludesOld && !oldIncludesNew) {
                mergedExtraction.conclusion = newConclusion;
              } else if (!oldIncludesNew && !newIncludesOld) {
                mergedExtraction.conclusion += ' ' + newConclusion;
              }
            }
          }
          
          // Merge references (combine into string)
          if (Array.isArray(ext.references) && ext.references.length > 0) {
            const refsList = ext.references.filter((r: any) => r && r.trim()).map((r: any) => removeNewlines(r.trim()));
            if (refsList.length > 0) {
              if (!mergedExtraction.references) {
                mergedExtraction.references = refsList.join(' ');
              } else {
                mergedExtraction.references += ' ' + refsList.join(' ');
              }
            }
          }
        }
      }
      
      return mergedExtraction;
    } catch (error) {
      console.error('Error parsing extraction chunks:', error);
      return null;
    }
  }, [extractionResult]);

  // Parse structured_data - extract title and sections from markdown_json format
  const [lastParsedData, setLastParsedData] = useState<{ title: string | null; sections: any; structuredData: any }>({
    title: null,
    sections: null,
    structuredData: null
  });

  const { title, sections, structuredData } = useMemo(() => {
    if (!extractionResult?.structured_data) return { title: null, sections: null, structuredData: null };
    
    try {
      let parsedData: any;
      if (typeof extractionResult.structured_data === 'string') {
        parsedData = JSON.parse(extractionResult.structured_data);
      } else {
        parsedData = extractionResult.structured_data;
      }
      
      // Check if it's the markdown_json format: 
      // Format 1: { "Title": { "Section1": "...", "Section2": "..." } }
      // Format 2: { "section_order": [...], "Title": { "Section1": "...", "Section2": "..." } }
      // Format 3: { "section_order": [...], "summaries": {...}, "Title": { "Section1": "...", "Section2": "..." } }
      // Format 4: { "sectionOrder": [...], "Abstract": "...", "Introduction": "...", "Conclusion": "..." } (flat structure)
      const keys = Object.keys(parsedData);
      
      // Find the title key (the key that's not section_order/sectionOrder/summaries and has an object value)
      // The title key should contain the actual document sections (Abstract, Introduction, etc.)
      const excludedKeys = ['section_order', 'sectionOrder', 'summaries', 'Content'];
      const titleKey = keys.find(key => 
        !excludedKeys.includes(key) && 
        typeof parsedData[key] === 'object' && 
        !Array.isArray(parsedData[key]) &&
        parsedData[key] !== null &&
        Object.keys(parsedData[key]).length > 0 // Ensure it has actual content
      );
      
      if (titleKey) {
        // Format 1-3: Nested structure with title key
        const sectionsObj = parsedData[titleKey];
        
        // Validate that sectionsObj has actual section data
        if (!sectionsObj || typeof sectionsObj !== 'object' || Array.isArray(sectionsObj)) {
          console.warn('Invalid sectionsObj structure:', sectionsObj);
          return { title: null, sections: null, structuredData: parsedData };
        }
        
        // Get document title (doctitle) - extract from Title section content if it exists
        // First check if there's a "Title" section with actual content
        let docTitle = '';
        if (sectionsObj.Title) {
          const titleContent = typeof sectionsObj.Title === 'string' 
            ? sectionsObj.Title 
            : (typeof sectionsObj.Title === 'object' && sectionsObj.Title !== null && !Array.isArray(sectionsObj.Title))
              ? String(sectionsObj.Title.content || sectionsObj.Title)
              : String(sectionsObj.Title);
          if (titleContent && titleContent.trim() && titleContent !== '[object Object]') {
            docTitle = titleContent.trim();
          }
        }
        // Fallback to titleKey if no Title section found
        if (!docTitle) {
          docTitle = titleKey || '';
        }
        
        // Helper function to check if two strings are similar (case-insensitive, ignoring punctuation)
        const areSimilar = (str1: string, str2: string): boolean => {
          if (!str1 || !str2) return false;
          const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
          const normalized1 = normalize(str1);
          const normalized2 = normalize(str2);
          
          // Check if they're exactly the same after normalization
          if (normalized1 === normalized2) return true;
          
          // Check if one contains the other (for partial matches)
          if (normalized1.length > 20 && normalized2.length > 20) {
            // For longer strings, check if one is a substantial substring of the other
            const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
            const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
            if (longer.includes(shorter) && shorter.length / longer.length > 0.8) {
              return true;
            }
          }
          
          // Calculate similarity using simple word overlap
          const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 2));
          const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 2));
          const intersection = new Set([...words1].filter(w => words2.has(w)));
          const union = new Set([...words1, ...words2]);
          const similarity = union.size > 0 ? intersection.size / union.size : 0;
          
          // Consider similar if > 70% word overlap
          return similarity > 0.7;
        };
        
        // Separate sections into regular sections and additional information
        const regularSections: any = {};
        const additionalInfo: any = {};
        
        for (const [sectionKey, sectionValue] of Object.entries(sectionsObj)) {
          // Skip the "Title" section itself (don't move it to Additional Information)
          if (sectionKey === 'Title') {
            regularSections[sectionKey] = sectionValue;
            continue;
          }
          
          // Check if this section's title is similar to the document title (including exact match)
          if (docTitle && areSimilar(sectionKey, docTitle)) {
            // Move to Additional Information (we'll hide the key when rendering if it matches exactly)
            additionalInfo[sectionKey] = sectionValue;
          } else {
            // Keep in regular sections
            regularSections[sectionKey] = sectionValue;
          }
        }
        
        // Add Additional Information section if we found similar titles
        if (Object.keys(additionalInfo).length > 0) {
          regularSections['Additional Information'] = additionalInfo;
        }
        
        return {
          title: titleKey,
          sections: regularSections,
          structuredData: parsedData // Keep for fallback
        };
      } else {
        // Format 4: Flat structure - sections are at root level
        // Check if we have section keys (not metadata keys)
        const sectionKeys = keys.filter(key => 
          !excludedKeys.includes(key) && 
          (typeof parsedData[key] === 'string' || typeof parsedData[key] === 'object')
        );
        
        if (sectionKeys.length > 0) {
          // Get document title (doctitle) - extract from Title field if it exists
          let docTitle = '';
          if (parsedData.Title) {
            const titleContent = typeof parsedData.Title === 'string' 
              ? parsedData.Title 
              : (typeof parsedData.Title === 'object' && parsedData.Title !== null && !Array.isArray(parsedData.Title))
                ? String(parsedData.Title.content || parsedData.Title)
                : String(parsedData.Title);
            if (titleContent && titleContent.trim() && titleContent !== '[object Object]') {
              docTitle = titleContent.trim();
            }
          }
          
          // Helper function to check if two strings are similar (case-insensitive, ignoring punctuation)
          const areSimilar = (str1: string, str2: string): boolean => {
            if (!str1 || !str2) return false;
            const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
            const normalized1 = normalize(str1);
            const normalized2 = normalize(str2);
            
            // Check if they're exactly the same after normalization
            if (normalized1 === normalized2) return true;
            
            // Check if one contains the other (for partial matches)
            if (normalized1.length > 20 && normalized2.length > 20) {
              // For longer strings, check if one is a substantial substring of the other
              const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
              const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
              if (longer.includes(shorter) && shorter.length / longer.length > 0.8) {
                return true;
              }
            }
            
            // Calculate similarity using simple word overlap
            const words1 = new Set(normalized1.split(/\s+/).filter(w => w.length > 2));
            const words2 = new Set(normalized2.split(/\s+/).filter(w => w.length > 2));
            const intersection = new Set([...words1].filter(w => words2.has(w)));
            const union = new Set([...words1, ...words2]);
            const similarity = union.size > 0 ? intersection.size / union.size : 0;
            
            // Consider similar if > 70% word overlap
            return similarity > 0.7;
          };
          
          // Create a sections object from flat structure, filtering out useless blocks
          const regularSections: any = {};
          const additionalInfo: any = {};
          
          sectionKeys.forEach(key => {
            const value = parsedData[key];
            
            // Filter out useless blocks:
            // 1. Skip numeric keys (like "0", "1", "2", "3")
            if (/^\d+$/.test(key)) {
              return;
            }
            
            // 2. Skip if value is an object with title/content structure that has invalid data
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Check if it's a malformed object like {"title":"0","content":"[object Object]"}
              if (value.title && value.content) {
                const titleStr = String(value.title);
                const contentStr = String(value.content);
                // Skip if title is just a number or content is "[object Object]"
                if (/^\d+$/.test(titleStr) || contentStr === '[object Object]' || contentStr === 'content') {
                  return;
                }
              }
            }
            
            // 3. Skip if value is string but is "[object Object]" or just "content"
            if (typeof value === 'string') {
              if (value === '[object Object]' || value.trim() === 'content' || value.trim().length === 0) {
                return;
              }
            }
            
            // Skip the "Title" section itself (don't move it to Additional Information)
            if (key === 'Title') {
              regularSections[key] = value;
              return;
            }
            
            // Check if this section's title is similar to the document title (including exact match)
            if (docTitle && areSimilar(key, docTitle)) {
              // Move to Additional Information (we'll hide the key when rendering if it matches exactly)
              additionalInfo[key] = value;
            } else {
              // Keep in regular sections
              regularSections[key] = value;
            }
          });
          
          // Add Additional Information section if we found similar titles
          if (Object.keys(additionalInfo).length > 0) {
            regularSections['Additional Information'] = additionalInfo;
          }
          
          // Filter out empty sections object
          const validSectionKeys = Object.keys(regularSections);
          if (validSectionKeys.length === 0) {
            return { title: null, sections: null, structuredData: parsedData };
          }
          
          // Use first valid section key as "title" or a default
          const defaultTitle = validSectionKeys[0] || 'Document';
          
          return {
            title: defaultTitle,
            sections: regularSections,
            structuredData: parsedData // Keep original for sectionOrder
          };
        }
      }
      
      // Fallback: return as is for other formats
      return { title: null, sections: null, structuredData: parsedData };
      
    } catch (e) {
      console.error('Error parsing structured_data:', e);
      return { title: null, sections: null, structuredData: null };
    }
  }, [extractionResult]);

  // Keep the last successfully parsed structured data so UI doesn't blank out on transient empty fetches
  useEffect(() => {
    if (title && sections && structuredData) {
      setLastParsedData({ title, sections, structuredData });
    }
  }, [title, sections, structuredData]);

  const effectiveTitle = title || lastParsedData.title;
  const effectiveSections = sections || lastParsedData.sections;
  const effectiveStructuredData = structuredData || lastParsedData.structuredData;

  // Update sectionOrder and sectionSummaries when structuredData changes
  useEffect(() => {
    if (!effectiveTitle || !effectiveSections || !effectiveStructuredData) return;
    
    // Load section order from structured_data or initialize default
    const parsedData = effectiveStructuredData;
    if (effectiveSections) {
      // Check for sectionOrder (camelCase) or section_order (snake_case)
      const savedOrderArray = parsedData.sectionOrder || parsedData.section_order;
      
      if (savedOrderArray && Array.isArray(savedOrderArray)) {
        // Use saved order, filter to only include existing sections
        const savedOrder = savedOrderArray.filter((key: string) => effectiveSections[key] !== undefined);
        // Add any missing sections to the end
        const sectionKeys = Object.keys(effectiveSections);
        const missingSections = sectionKeys.filter(key => !savedOrder.includes(key));
        const newOrder = [...savedOrder, ...missingSections];
        // Only update if different to avoid unnecessary re-renders
        setSectionOrder(prevOrder => {
          if (JSON.stringify(prevOrder) !== JSON.stringify(newOrder)) {
            return newOrder;
          }
          return prevOrder;
        });
      } else {
        // Initialize default order if no saved order exists
        const defaultOrder = ['Abstract', 'Introduction', 'Conclusion', 'References'];
        const sectionKeys = Object.keys(effectiveSections);
        const otherSections = sectionKeys.filter(
          key => !defaultOrder.includes(key)
        );
        const newOrder = [...defaultOrder.filter(k => sectionKeys.includes(k)), ...otherSections];
        setSectionOrder(prevOrder => {
          if (JSON.stringify(prevOrder) !== JSON.stringify(newOrder)) {
            return newOrder;
          }
          return prevOrder;
        });
      }
    }
    
    // Load section summaries if they exist
    // Filter out malformed summaries (incomplete JSON strings)
    if (parsedData?.summaries && typeof parsedData.summaries === 'object') {
      const validSummaries: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsedData.summaries)) {
        // Only include summaries that are complete strings (not incomplete JSON like "{\"")
        if (typeof value === 'string' && value.length > 3 && !value.match(/^\{["']?$/)) {
          validSummaries[key] = value;
        }
      }
      // Only update if different to avoid unnecessary re-renders
      setSectionSummaries(prevSummaries => {
        if (JSON.stringify(prevSummaries) !== JSON.stringify(validSummaries)) {
          return validSummaries;
        }
        return prevSummaries;
      });
    }
  }, [effectiveTitle, effectiveSections, effectiveStructuredData]);

  // Cache the last valid extracted_text to prevent it from disappearing on tab switch
  const [lastExtractedText, setLastExtractedText] = useState<string>('');

  // Update cache when extractionResult.extracted_text changes
  useEffect(() => {
    if (extractionResult?.extracted_text) {
      setLastExtractedText(extractionResult.extracted_text);
    }
  }, [extractionResult?.extracted_text]);

  // Extract text directly from extracted_text (markdown format)
  const extractTextFromJson = useMemo(() => {
    // Use current text if available, otherwise fall back to cached text
    return extractionResult?.extracted_text || lastExtractedText || '';
  }, [extractionResult?.extracted_text, lastExtractedText]);

  // Get full text as single continuous block (remove page break markers and deduplicate for group views)
  const fullTextContent = useMemo(() => {
    if (!extractTextFromJson) return '';
    
    // For group views, deduplicate content across document breaks
    // Split by document breaks first
    const documentSections = extractTextFromJson.split(/---\s*Document\s*Break\s*---/gi);
    
    if (documentSections.length > 1 && isGroupView) {
      // Group view with multiple documents - deduplicate cumulative content
      // Strategy: Process documents in order, only keep new sections that haven't been seen
      const seenHeaders = new Set<string>(); // Track which headers we've already added
      const finalSections: string[] = [];
      
      documentSections.forEach((section, sectionIndex) => {
        const trimmedSection = section.trim();
        if (!trimmedSection) return;
        
        // Extract headers and their content from this document
        const lines = trimmedSection.split('\n');
        const sections: Array<{ header: string; content: string[] }> = [];
        let currentHeader: string | null = null;
        let currentContent: string[] = [];
        
        lines.forEach((line) => {
          const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
          if (headerMatch) {
            // Save previous section if exists
            if (currentHeader && currentContent.length > 0) {
              sections.push({ header: currentHeader, content: [...currentContent] });
              currentContent = [];
            }
            // Fix spacing issue in header: remove space between single capital letter and following lowercase letter
            let headerText = headerMatch[2].trim();
            headerText = headerText.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
            currentHeader = headerText;
          } else if (currentHeader) {
            currentContent.push(line);
          }
        });
        
        // Save last section
        if (currentHeader && currentContent.length > 0) {
          sections.push({ header: currentHeader, content: [...currentContent] });
        }
        
        // Process each section: only add if header not seen before
        sections.forEach(({ header, content }) => {
          const normalizedHeader = header.toLowerCase().trim();
          
          if (!seenHeaders.has(normalizedHeader)) {
            // New header - add it
            seenHeaders.add(normalizedHeader);
            // Fix spacing issue in header before adding
            const fixedHeader = header.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
            finalSections.push(`## ${fixedHeader}`);
            finalSections.push(...content);
          }
          // If header already seen, skip it (it's a duplicate from cumulative content)
        });
      });
      
      // Join deduplicated sections
      const deduplicatedText = finalSections.join('\n');
      
      // Replace page break markers with double newlines
      const cleanedText = deduplicatedText
        .replace(/---\s*Page\s*Break\s*---/gi, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      // Fix spacing issue: remove space between single capital letter and following lowercase letter
      // Pattern: "I ntroduction" -> "Introduction", "A bstract" -> "Abstract"
      return cleanedText.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
    } else {
      // Single document or no document breaks - just clean up page breaks
      const cleanedText = extractTextFromJson
        .replace(/---\s*Page\s*Break\s*---/gi, '\n\n')
        .replace(/---\s*Document\s*Break\s*---/gi, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      // Fix spacing issue: remove space between single capital letter and following lowercase letter
      // Pattern: "I ntroduction" -> "Introduction", "A bstract" -> "Abstract"
      return cleanedText.replace(/\b([A-Z])\s+([a-z])/g, '$1$2');
    }
  }, [extractTextFromJson, isGroupView]);

  // For extracted_text view, always return single page
  const textPages = useMemo(() => {
    if (!fullTextContent) return [];
    // Return as single page for continuous text view
    return [fullTextContent];
  }, [fullTextContent]);

  // Initialize editable text when extraction result changes
  useEffect(() => {
    if (textPages.length > 1 && currentPage > 0) {
      const secondPageIndex = currentPage;
      if (secondPageIndex < textPages.length) {
        setEditableText(textPages[secondPageIndex]);
      }
    } else if (textPages.length === 1) {
      setEditableText('');
    }
  }, [textPages, currentPage]);

  // Get current pages to display (show 2 pages at a time)
  const currentPages = useMemo(() => {
    if (textPages.length === 0) return ['', ''];

    const startIndex = currentPage - 1;
    const pages = [];

    if (startIndex >= 0 && startIndex < textPages.length) {
      pages.push(textPages[startIndex]);
    } else {
      pages.push('');
    }

    if (startIndex + 1 >= 0 && startIndex + 1 < textPages.length) {
      pages.push(textPages[startIndex + 1]);
    } else {
      pages.push('');
    }

    return pages.length === 2 ? pages : ['', ''];
  }, [textPages, currentPage]);

  const filteredStructuredData = useMemo(() => {
    if (!structuredData) return null;
    if (!searchTerm.trim()) return structuredData;
    return structuredData;
  }, [structuredData, searchTerm]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleSaveEditableText = async () => {
    if (!id) return;
    
    setIsSaving(true);
    try {
      // TODO: Add API endpoint to save edited text
      // For now, just show a success message
      alert('Text saved successfully! (Note: This feature needs a backend API endpoint)');
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Failed to save text. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.fullScreenLayout}>
        <SessionStatus user={user} showDetails={false} />
        <Header user={user} />
        <div className={styles.documentsContainer}>
          <div className={styles.titleSection} style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: 'calc(100vh - 200px)'
          }}>
            <Loading text="Loading" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // For group view, allow rendering even if extractionResult is not ready yet
  // For regular document view, require extractionResult
  if (!isGroupView && !extractionResult) {
    return (
      <div className={styles.fullScreenLayout}>
        <SessionStatus user={user} showDetails={false} />
        <Header user={user} />
        <div className={styles.documentsContainer}>
          <div className={styles.titleSection}>
            <button
              onClick={() => navigate('/scanner')}
              className={styles.backButton}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="bi bi-arrow-left-short" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5" />
              </svg>
            </button>
            <h1 className={styles.mainTitle}>Extraction Result Not Found</h1>
            <p className={styles.mainDescription}>The extraction result for this document is not available yet. Please wait for processing to complete.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Note: extractionResult should always be set for group view (even if empty) from useEffect
  // This ensures the page can render even if extraction results aren't ready yet

  return (
    <div className={styles.fullScreenLayout}>
      <SessionStatus user={user} showDetails={false} />
      <Header user={user} />
      <div className={styles.documentsContainer}>
        <div className={styles.documentViewer}>
          {/* Main Document Content */}
          <div className={styles.documentContent}>
            <div className={styles.documentHeader}>
              <div className={styles.headerLeft}>
                <button
                  onClick={() => navigate('/scanner')}
                  className={styles.backButton}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" className="bi bi-arrow-left-short" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5" />
                  </svg>
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h1 className={styles.documentTitle}>
                    {isGroupView 
                      ? (groupDocuments.length > 0 
                          ? (groupDocuments[0].display_name || groupDocuments[0].group_name || groupDocuments[0].file_name || 'Group')
                          : 'Group')
                      : (document?.display_name || document?.original_name || 'Document')
                    }
                  </h1>
                  {isGroupView && groupDocuments.length > 0 && (
                    <div style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
                      Combined results from {groupDocuments.length} {groupDocuments.length === 1 ? 'file' : 'files'}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  // For group views, always show carousel if there are multiple documents
                  if (isGroupView && groupDocuments.length > 1) {
                    setShowOriginalCarousel(true);
                    setCurrentImageIndex(0);
                  } 
                  // If there are multiple images with same file_name, show carousel
                  else if (relatedImages.length > 1 || (document?.mime_type && document.mime_type.startsWith('image/'))) {
                    setShowOriginalCarousel(true);
                    setCurrentImageIndex(0);
                  } 
                  // For group view with single document, download it
                  else if (isGroupView && groupDocuments.length === 1 && groupDocuments[0]?.id) {
                    window.open(`/api/documents/download/${groupDocuments[0].id}`, '_blank');
                  }
                  // Otherwise, download the single document
                  else if (document?.id) {
                    window.open(`/api/documents/download/${document.id}`, '_blank');
                  }
                }}
                className={styles.viewOriginalButton}
              >
                View Original
              </button>
            </div>

            <div className={styles.searchSection}>
              <div className={styles.searchInputWrapper}>
                <input
                  type="text"
                  placeholder="Find"
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className={styles.searchIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search-heart" viewBox="0 0 16 16">
                    <path d="M6.5 4.482c1.664-1.673 5.825 1.254 0 5.018-5.825-3.764-1.664-6.69 0-5.018" />
                    <path d="M13 6.5a6.47 6.47 0 0 1-1.258 3.844q.06.044.115.098l3.85 3.85a1 1 0 0 1-1.414 1.415l-3.85-3.85a1 1 0 0 1-.1-.115h.002A6.5 6.5 0 1 1 13 6.5M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11" />
                  </svg>
                </span>
              </div>
            </div>

            <div className={styles.documentControls}>
              <button
                className={`${styles.controlButton} ${activeTab === 'text' ? styles.active : ''}`}
                onClick={() => setActiveTab('text')}
              >
                Extracted Text
              </button>
              <button
                className={`${styles.controlButton} ${activeTab === 'data' ? styles.active : ''}`}
                onClick={() => setActiveTab('data')}
              >
                Structured Data
              </button>
            </div>

            <div className={styles.documentBody}>
              {activeTab === 'text' ? (
                <div className={styles.documentText}>
                  {loadingOcrMarkdown ? (
                    <div className={styles.noContent}>Loading OCR content...</div>
                  ) : (isGroupView && ocrMarkdown) ? (
                    // For group views, prioritize OCR markdown API (has correct image paths with subdirectories)
                    <div className={styles.singleTextContainer}>
                      <div
                        ref={textContentRef}
                        className={styles.singleTextPage}
                      >
                        <div className={styles.readOnlyText}>
                          <MemoizedMarkdown 
                            id={`ocr-markdown-group-${document?.id || 'unknown'}`} 
                            content={ocrMarkdown} 
                            groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                            searchTerm={searchTerm}
                          />
                        </div>
                      </div>
                    </div>
                  ) : fullTextContent ? (
                    // For individual views, prioritize extracted_text from database
                    <div className={styles.singleTextContainer}>
                      <div
                        ref={textContentRef}
                        className={styles.singleTextPage}
                      >
                        <div className={styles.readOnlyText}>
                          <MemoizedMarkdown 
                            id={`text-content-${document?.id || 'unknown'}`} 
                            content={fullTextContent} 
                            groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                            searchTerm={searchTerm}
                          />
                        </div>
                      </div>
                    </div>
                  ) : ocrMarkdown ? (
                    // Fallback to markdown loaded from files if extracted_text not in database
                    <div className={styles.singleTextContainer}>
                      <div
                        ref={textContentRef}
                        className={styles.singleTextPage}
                      >
                        <div className={styles.readOnlyText}>
                          <MemoizedMarkdown 
                            id={`ocr-markdown-${document?.id || 'unknown'}`} 
                            content={ocrMarkdown} 
                            groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                            searchTerm={searchTerm}
                          />
                        </div>
                      </div>
                    </div>
                  ) : document?.group_name && extractionResult?.status === 'completed' ? (
                    <div className={styles.noContent}>
                      OCR processing completed but no markdown files found. 
                      <br />Check server logs for details.
                    </div>
                  ) : (
                    <div className={styles.noContent}>No text extracted</div>
                  )}
                </div>
              ) : (
                <div className={styles.documentData}>
                  {effectiveTitle && effectiveSections ? (
                    <div className={styles.structuredDataContent}>
                      {/* Display Title */}
                      {/* <div className={styles.dataItem} style={{ marginBottom: '2em', borderBottom: '2px solid #e0e0e0', paddingBottom: '1em' }}>
                        <span className={styles.dataLabel} style={{ fontSize: '1.4em', fontWeight: 'bold' }}>Title</span>
                        <span className={styles.dataValue} style={{ fontSize: '1.15em' }}>
                          {searchTerm.trim() ? highlightSearchTerm(effectiveTitle) : effectiveTitle}
                        </span>
                      </div> */}

                      {/* Display Sections in Order with Drag-and-Drop */}
                      {(() => {
                        // Get ordered sections (Abstract, Introduction, others, Conclusion, References)
                        const orderedSections = sectionOrder.length > 0 
                          ? sectionOrder.filter(key => effectiveSections[key] !== undefined)
                          : ['Abstract', 'Introduction', 'Conclusion', 'References', ...Object.keys(effectiveSections).filter(k => !['Abstract', 'Introduction', 'Conclusion', 'References'].includes(k))];
                        
                        const handleDragStart = (index: number, e?: React.DragEvent) => {
                          // Only allow drag if it started from the hamburger icon
                          if (dragSourceRef.current !== index && e) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          setDraggedIndex(index);
                        };

                        let currentOrder = orderedSections; // Track current order for saving

                        const handleDragOver = (e: React.DragEvent, index: number) => {
                          e.preventDefault();
                          if (draggedIndex === null) return;
                          
                          if (draggedIndex !== index) {
                            const newOrder = [...orderedSections];
                            const draggedItem = newOrder[draggedIndex];
                            newOrder.splice(draggedIndex, 1);
                            newOrder.splice(index, 0, draggedItem);
                            currentOrder = newOrder; // Update current order
                            setSectionOrder(newOrder);
                            setDraggedIndex(index);
                          }
                        };

                        const handleDragEnd = async () => {
                          setDraggedIndex(null);
                          dragSourceRef.current = null;
                          // Save the new order to database
                          if (id && currentOrder.length > 0) {
                            try {
                              const response = await fetch(`/api/documents/save-section-order/${id}`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                  sectionOrder: currentOrder
                                })
                              });
                              
                              if (response.ok) {
                                console.log('✅ Section order saved to database');
                              } else {
                                console.error('Failed to save section order:', await response.text());
                              }
                            } catch (error) {
                              console.error('Error saving section order:', error);
                            }
                          }
                        };

                        return orderedSections.map((sectionKey, index) => {
                          const sectionValue = effectiveSections[sectionKey];
                          if (!sectionValue) return null;
                          
                          // Filter out useless blocks
                          // 1. Skip numeric keys
                          if (/^\d+$/.test(sectionKey)) {
                            return null;
                          }
                          
                          // Special handling for "Additional Information" - it contains nested sections
                          if (sectionKey === 'Additional Information' && typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue)) {
                            // Render Additional Information with nested sections
                            const additionalInfoKeys = Object.keys(sectionValue);
                            if (additionalInfoKeys.length === 0) return null;
                            
                            return (
                              <div
                                key={sectionKey}
                                draggable
                                onDragStart={(e) => handleDragStart(index, e)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={styles.dataItem}
                                style={{
                                  opacity: draggedIndex === index ? 0.5 : 1,
                                  border: '2px solid #e0e0e0',
                                  borderRadius: '20px',
                                  padding: '1em',
                                  marginBottom: '1em',
                                  backgroundColor: draggedIndex === index ? '#f5f5f5' : 'white',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em' }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span 
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        dragSourceRef.current = index;
                                      }}
                                      style={{ 
                                        marginRight: '0.5em', 
                                        marginTop: '-0.35em', 
                                        cursor: 'grab', 
                                        fontSize: '1.2em',
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none'
                                      }}
                                    >☰</span>
                                    <span className={styles.dataLabel} style={{ fontSize: '1.4em', fontWeight: 'bold' }}>
                                      {sectionKey.replace(/\b([A-Z])\s+([a-z])/g, '$1$2')}
                                    </span>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      setSummarizingSection(sectionKey);
                                      try {
                                        // For group views, use group_name; for individual views, use document id
                                        const identifier = isGroupView 
                                          ? (group_name ? decodeURIComponent(group_name) : document?.group_name || '')
                                          : (id || '');
                                        
                                        if (!identifier) {
                                          alert('Unable to identify document or group');
                                          setSummarizingSection(null);
                                          return;
                                        }
                                        
                                        const response = await fetch(`/api/documents/summarize-section/${encodeURIComponent(identifier)}`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          credentials: 'include',
                                          body: JSON.stringify({
                                            sectionKey: sectionKey,
                                            sectionValue: sectionValue
                                          })
                                        });
                                        
                                        if (response.ok) {
                                          const result = await response.json();
                                          setSectionSummaries(prev => ({
                                            ...prev,
                                            [sectionKey]: result[sectionKey] || result.summary || ''
                                          }));
                                          
                                          // Reload extraction result to get updated structured_data
                                          if (isGroupView) {
                                            const groupNameToUse = group_name ? decodeURIComponent(group_name) : document?.group_name || '';
                                            if (groupNameToUse) {
                                              const groupRes = await fetch(`/api/documents/group/${encodeURIComponent(groupNameToUse)}`, { credentials: 'include' });
                                              if (groupRes.ok) {
                                                const groupData = await groupRes.json();
                                                if (groupData.combinedExtractionResult) {
                                                  setExtractionResult({
                                                    id: 'group-combined',
                                                    extracted_text: groupData.combinedExtractionResult.extracted_text || '',
                                                    structured_data: groupData.combinedExtractionResult.structured_data || {},
                                                    accuracy: groupData.combinedExtractionResult.accuracy || 0,
                                                    processing_time_ms: groupData.combinedExtractionResult.processing_time_ms || 0,
                                                    status: groupData.combinedExtractionResult.status || 'completed',
                                                    created_at: undefined
                                                  });
                                                }
                                              }
                                            }
                                          } else {
                                            const extractRes = await fetch(`/api/documents/extract/${id}`, { credentials: 'include' });
                                            if (extractRes.ok) {
                                              const extractData = await extractRes.json();
                                              setExtractionResult(extractData);
                                            }
                                          }
                                        } else {
                                          const error = await response.json();
                                          alert(`Failed to summarize: ${error.error || 'Unknown error'}`);
                                        }
                                      } catch (error) {
                                        console.error('Error summarizing section:', error);
                                        alert('Failed to summarize section. Please try again.');
                                      } finally {
                                        setSummarizingSection(null);
                                      }
                                    }}
                                    disabled={summarizingSection === sectionKey}
                                    style={{
                                      padding: '0.4em 0.8em',
                                      fontSize: '0.9em',
                                      backgroundColor: summarizingSection === sectionKey ? '#ccc' : '#7C3AED',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '50px',
                                      cursor: summarizingSection === sectionKey ? 'not-allowed' : 'pointer',
                                      fontWeight: '500'
                                    }}
                                  >
                                    {summarizingSection === sectionKey ? 'Summarizing...' : 'Summarize'}
                                  </button>
                                </div>
                                {sectionSummaries[sectionKey] && !hiddenSummaries.has(sectionKey) && (
                                  <div style={{ 
                                    marginBottom: '1em', 
                                    padding: '1em', 
                                    backgroundColor: '#f0f7ff', 
                                    borderRadius: '8px',
                                    border: '1px solid #b3d9ff',
                                    position: 'relative'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5em' }}>
                                      <div style={{ fontSize: '0.95em', fontWeight: 'bold', color: '#0056b3' }}>
                                        Summary:
                                      </div>
                                      <button
                                        onClick={() => {
                                          setHiddenSummaries(prev => {
                                            const newSet = new Set(prev);
                                            newSet.add(sectionKey);
                                            return newSet;
                                          });
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          fontSize: '1.2em',
                                          color: '#666',
                                          cursor: 'pointer',
                                          padding: '0 0.3em',
                                          lineHeight: '1',
                                          fontWeight: 'bold'
                                        }}
                                        title="Hide summary"
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '1em', lineHeight: '1.6', color: '#333' }}>
                                      {sectionSummaries[sectionKey]}
                                    </div>
                                  </div>
                                )}
                                {sectionSummaries[sectionKey] && hiddenSummaries.has(sectionKey) && (
                                  <div style={{ marginBottom: '1em' }}>
                                    <button
                                      onClick={() => {
                                        setHiddenSummaries(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(sectionKey);
                                          return newSet;
                                        });
                                      }}
                                      style={{
                                        padding: '0.4em 0.8em',
                                        fontSize: '0.9em',
                                        backgroundColor: '#6B7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        marginLeft: '20px'
                                      }}
                                      title="Show summary"
                                    >
                                      Show summary
                                    </button>
                                  </div>
                                )}
                                <div className={styles.dataValue} style={{ display: 'block', marginLeft: '1.5em', fontSize: '1.15em' }}>
                                  {(() => {
                                    // Get document title from Title section if it exists
                                    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
                                    let docTitle = '';
                                    
                                    // Try to get docTitle from effectiveSections (Title section)
                                    if (effectiveSections && effectiveSections.Title) {
                                      const titleContent = typeof effectiveSections.Title === 'string' 
                                        ? effectiveSections.Title 
                                        : (typeof effectiveSections.Title === 'object' && effectiveSections.Title !== null && !Array.isArray(effectiveSections.Title))
                                          ? String(effectiveSections.Title.content || effectiveSections.Title)
                                          : '';
                                      if (titleContent && titleContent.trim() && titleContent !== '[object Object]') {
                                        docTitle = titleContent.trim();
                                      }
                                    }
                                    
                                    // Fallback: try to get from effectiveStructuredData
                                    if (!docTitle && effectiveStructuredData) {
                                      if (effectiveStructuredData.Title) {
                                        const titleContent = typeof effectiveStructuredData.Title === 'string' 
                                          ? effectiveStructuredData.Title 
                                          : (typeof effectiveStructuredData.Title === 'object' && effectiveStructuredData.Title !== null)
                                            ? String(effectiveStructuredData.Title.content || effectiveStructuredData.Title)
                                            : '';
                                        if (titleContent && titleContent.trim() && titleContent !== '[object Object]') {
                                          docTitle = titleContent.trim();
                                        }
                                      }
                                    }
                                    
                                    const normalizedDocTitle = docTitle ? normalize(docTitle) : '';
                                    
                                    return additionalInfoKeys
                                      .filter((infoKey) => {
                                        const infoValue = (sectionValue as any)[infoKey];
                                        const infoValueStr = typeof infoValue === 'string' 
                                          ? infoValue 
                                          : (typeof infoValue === 'object' && infoValue !== null && !Array.isArray(infoValue))
                                            ? String(infoValue.content || infoValue)
                                            : String(infoValue);
                                        
                                        // Filter out "[object Object]" content
                                        if (infoValueStr === '[object Object]' || infoValueStr.trim() === 'content' || infoValueStr.trim().length === 0) {
                                          return false;
                                        }
                                        
                                        return true;
                                      })
                                      .map((infoKey) => {
                                        const infoValue = (sectionValue as any)[infoKey];
                                        const infoValueStr = typeof infoValue === 'string' 
                                          ? infoValue 
                                          : (typeof infoValue === 'object' && infoValue !== null && !Array.isArray(infoValue))
                                            ? String(infoValue.content || infoValue)
                                            : String(infoValue);
                                        
                                        // Check if the key matches the document title (to hide the key header)
                                        const normalizedInfoKey = normalize(infoKey);
                                        const shouldHideKey = normalizedDocTitle && normalizedInfoKey === normalizedDocTitle;
                                        
                                        return (
                                          <div key={infoKey} style={{ marginBottom: '1em', paddingLeft: '0' }}>
                                            {!shouldHideKey && (
                                              <div style={{ fontWeight: 'bold', marginBottom: '0.5em', color: '#666', fontSize: '1.1em' }}>{infoKey}</div>
                                            )}
                                            <MemoizedMarkdown 
                                              id={`additional-info-${infoKey}`} 
                                              content={infoValueStr}
                                              searchTerm={searchTerm} 
                                              groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                            />
                                          </div>
                                        );
                                      });
                                  })()}
                                </div>
                              </div>
                            );
                          }
                          
                          // 2. Skip if value is "[object Object]" or empty placeholder
                          const valueStr = typeof sectionValue === 'string' 
                            ? sectionValue 
                            : (typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue))
                              ? String(sectionValue.content || sectionValue)
                              : String(sectionValue);
                          
                          if (valueStr === '[object Object]' || 
                              valueStr.trim() === 'content' || 
                              valueStr.trim().length === 0) {
                            return null;
                          }
                          
                          // 3. Skip if it's an object with title/content that has invalid data
                          if (typeof sectionValue === 'object' && sectionValue !== null && !Array.isArray(sectionValue)) {
                            if (sectionValue.title && sectionValue.content) {
                              const titleStr = String(sectionValue.title);
                              const contentStr = String(sectionValue.content);
                              if (/^\d+$/.test(titleStr) || contentStr === '[object Object]' || contentStr === 'content') {
                                return null;
                              }
                            }
                          }

                          return (
                            <div
                              key={sectionKey}
                              draggable
                              onDragStart={(e) => handleDragStart(index, e)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              className={styles.dataItem}
                              style={{
                                opacity: draggedIndex === index ? 0.5 : 1,
                                border: '2px solid #e0e0e0',
                                borderRadius: '20px',
                                padding: '1em',
                                marginBottom: '1em',
                                backgroundColor: draggedIndex === index ? '#f5f5f5' : 'white',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span 
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      dragSourceRef.current = index;
                                    }}
                                    style={{ 
                                      marginRight: '0.5em', 
                                      marginTop: '-0.35em', 
                                      cursor: 'grab', 
                                      fontSize: '1.2em',
                                      userSelect: 'none',
                                      WebkitUserSelect: 'none'
                                    }}
                                  >☰</span>
                                  <span className={styles.dataLabel} style={{ fontSize: '1.4em', fontWeight: 'bold' }}>
                                    {sectionKey.replace(/\b([A-Z])\s+([a-z])/g, '$1$2')}
                                  </span>
                                </div>
                                <button
                                  onClick={async () => {
                                    setSummarizingSection(sectionKey);
                                    try {
                                      // For group views, use group_name; for individual views, use document id
                                      const identifier = isGroupView 
                                        ? (group_name ? decodeURIComponent(group_name) : document?.group_name || '')
                                        : (id || '');
                                      
                                      if (!identifier) {
                                        alert('Unable to identify document or group');
                                        setSummarizingSection(null);
                                        return;
                                      }
                                      
                                      const response = await fetch(`/api/documents/summarize-section/${encodeURIComponent(identifier)}`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json'
                                        },
                                        credentials: 'include',
                                        body: JSON.stringify({
                                          sectionKey: sectionKey,
                                          sectionValue: sectionValue
                                        })
                                      });
                                      
                                      if (response.ok) {
                                        const result = await response.json();
                                        // Update local state with the summary
                                        setSectionSummaries(prev => ({
                                          ...prev,
                                          [sectionKey]: result[sectionKey] || result.summary || ''
                                        }));
                                        
                                        // Reload extraction result to get updated structured_data
                                        if (isGroupView) {
                                          const groupNameToUse = group_name ? decodeURIComponent(group_name) : document?.group_name || '';
                                          if (groupNameToUse) {
                                            const groupRes = await fetch(`/api/documents/group/${encodeURIComponent(groupNameToUse)}`, { credentials: 'include' });
                                            if (groupRes.ok) {
                                              const groupData = await groupRes.json();
                                              if (groupData.combinedExtractionResult) {
                                                setExtractionResult({
                                                  id: 'group-combined',
                                                  extracted_text: groupData.combinedExtractionResult.extracted_text || '',
                                                  structured_data: groupData.combinedExtractionResult.structured_data || {},
                                                  accuracy: groupData.combinedExtractionResult.accuracy || 0,
                                                  processing_time_ms: groupData.combinedExtractionResult.processing_time_ms || 0,
                                                  status: groupData.combinedExtractionResult.status || 'completed',
                                                  created_at: undefined
                                                });
                                              }
                                            }
                                          }
                                        } else {
                                          const extractRes = await fetch(`/api/documents/extract/${id}`, { credentials: 'include' });
                                          if (extractRes.ok) {
                                            const extractData = await extractRes.json();
                                            setExtractionResult(extractData);
                                          }
                                        }
                                      } else {
                                        const error = await response.json();
                                        alert(`Failed to summarize: ${error.error || 'Unknown error'}`);
                                      }
                                    } catch (error) {
                                      console.error('Error summarizing section:', error);
                                      alert('Failed to summarize section. Please try again.');
                                    } finally {
                                      setSummarizingSection(null);
                                    }
                                  }}
                                  disabled={summarizingSection === sectionKey}
                                  style={{
                                    padding: '0.4em 0.8em',
                                    fontSize: '0.9em',
                                    backgroundColor: summarizingSection === sectionKey ? '#ccc' : '#7C3AED',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50px',
                                    cursor: summarizingSection === sectionKey ? 'not-allowed' : 'pointer',
                                    fontWeight: '500'
                                  }}
                                >
                                  {summarizingSection === sectionKey ? 'Summarizing...' : 'Summarize'}
                                </button>
                              </div>
                              {sectionSummaries[sectionKey] && !hiddenSummaries.has(sectionKey) && (
                                <div style={{ 
                                  marginBottom: '1em', 
                                  padding: '1em', 
                                  backgroundColor: '#f0f7ff', 
                                  borderRadius: '8px',
                                  border: '1px solid #b3d9ff',
                                  position: 'relative'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5em' }}>
                                    <div style={{ fontSize: '0.95em', fontWeight: 'bold', color: '#0056b3' }}>
                                      Summary:
                                    </div>
                                    <button
                                      onClick={() => {
                                        setHiddenSummaries(prev => {
                                          const newSet = new Set(prev);
                                          newSet.add(sectionKey);
                                          return newSet;
                                        });
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.2em',
                                        color: '#666',
                                        cursor: 'pointer',
                                        padding: '0 0.3em',
                                        lineHeight: '1',
                                        fontWeight: 'bold'
                                      }}
                                      title="Hide summary"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div style={{ fontSize: '1em', lineHeight: '1.6', color: '#333' }}>
                                    {sectionSummaries[sectionKey]}
                                  </div>
                                </div>
                              )}
                              {sectionSummaries[sectionKey] && hiddenSummaries.has(sectionKey) && (
                                <div style={{ marginBottom: '1em' }}>
                                  <button
                                    onClick={() => {
                                      setHiddenSummaries(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(sectionKey);
                                        return newSet;
                                      });
                                    }}
                                    style={{
                                      padding: '0.4em 0.8em',
                                      fontSize: '0.9em',
                                      backgroundColor: '#6B7280',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '50px',
                                      cursor: 'pointer',
                                      fontWeight: '500',
                                      marginLeft: '20px'
                                    }}
                                    title="Show summary"
                                  >
                                    Show summary
                                  </button>
                                </div>
                              )}
                              <div className={styles.dataValue} style={{ display: 'block', marginLeft: '1.5em', fontSize: '1.15em' }}>
                                {Array.isArray(sectionValue) ? (
                                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    {sectionValue.map((item: any, idx: number) => (
                                      <li key={idx}>
                                        {Array.isArray(item) ? (
                                          <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                            {item.map((subItem: any, subIdx: number) => (
                                              <li key={subIdx}>
                                                <MemoizedMarkdown 
                                                  id={`structured-section-${sectionKey}-${idx}-${subIdx}`}
                                                  content={String(subItem)}
                                                  groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                                  searchTerm={searchTerm}
                                                />
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <MemoizedMarkdown 
                                            id={`structured-section-${sectionKey}-${idx}`}
                                            content={String(item)}
                                            groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                            searchTerm={searchTerm}
                                          />
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <MemoizedMarkdown 
                                    id={`structured-section-${sectionKey}`}
                                    content={String(sectionValue)}
                                    groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                    searchTerm={searchTerm}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : structuredData ? (
                    <div className={styles.structuredDataContent}>
                      {/* Fallback: Display Dify extraction format (title, authors, topics, etc.) */}
                      <>
                        {/* Display Title */}
                        {structuredData.title && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>Title</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-title-${id || 'unknown'}`}
                                content={String(structuredData.title)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}

                        {/* Display Authors */}
                        {structuredData.authors && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>Authors</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-authors-${id || 'unknown'}`}
                                content={String(structuredData.authors)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Display Introduction */}
                        {structuredData.introduction && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>Introduction</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-introduction-${id || 'unknown'}`}
                                content={String(structuredData.introduction)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Display Abstract */}
                        {structuredData.abstract && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>Abstract</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-abstract-${id || 'unknown'}`}
                                content={String(structuredData.abstract)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Display Topics - Each topic in its own card */}
                        {structuredData.topics && Array.isArray(structuredData.topics) && structuredData.topics.length > 0 && (
                          <div className={styles.topicsSection}>
                            <div className={styles.topicsContainer}>
                              {structuredData.topics.map((topic: any, index: number) => (
                                <div key={index} className={styles.topicCard}>
                                  <div className={styles.topicTitle}>
                                    {topic.topic_title || `Topic ${index + 1}`}
                                  </div>
                                  {topic.subtopics && Array.isArray(topic.subtopics) && topic.subtopics.length > 0 ? (
                                    <div className={styles.subtopicsContainer}>
                                      {topic.subtopics.map((subtopic: any, subIndex: number) => (
                                        <div key={subIndex} className={styles.subtopicCard}>
                                          {subtopic.subtopic_title && (
                                            <div className={styles.subtopicTitle}>
                                              {subtopic.subtopic_title}
                                            </div>
                                          )}
                                          {subtopic.content && (
                                            <div className={styles.subtopicContent}>
                                              <MemoizedMarkdown 
                                                id={`structured-topic-${index}-subtopic-${subIndex}`}
                                                content={String(subtopic.content)}
                                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                                searchTerm={searchTerm}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className={styles.topicSummary}>
                                      <MemoizedMarkdown 
                                        id={`structured-topic-${index}-summary`}
                                        content={String(topic.summary || 'No content available')}
                                        groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Display Conclusion */}
                        {structuredData.conclusion && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>Conclusion</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-conclusion-${id || 'unknown'}`}
                                content={String(structuredData.conclusion)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Display References */}
                        {structuredData.references && (
                          <div className={styles.dataItem}>
                            <span className={styles.dataLabel}>References</span>
                            <div className={styles.dataValue}>
                              <MemoizedMarkdown 
                                id={`structured-references-${id || 'unknown'}`}
                                content={String(structuredData.references)}
                                groupname={group_name ? decodeURIComponent(group_name) : document?.group_name}
                                searchTerm={searchTerm}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    </div>
                  ) : (
                    <div className={styles.noContent}>
                      {convertingMarkdown ? (
                        <div>
                          <Loading />
                          <p>Converting markdown to structured data...</p>
                        </div>
                      ) : (
                        'No structured data available'
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {(activeTab === 'text' && false) || (activeTab !== 'text' && (document?.page_count || 1) > 1) ? (
              <div className={styles.documentPagination}>
                <button
                  className={styles.paginationButton}
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(Math.max(1, currentPage - 1));
                  }}
                >
                  ← Previous
                </button>
                <div className={styles.pageNumbers}>
                  {(() => {
                    const totalPages = (document?.page_count || 1);
                    const pages: (number | string)[] = [];
                    const maxVisible = 5;

                    if (totalPages <= maxVisible) {
                      for (let i = 1; i <= totalPages; i++) {
                        pages.push(i);
                      }
                    } else {
                      pages.push(1);

                      if (currentPage > 3) {
                        pages.push('...');
                      }

                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);

                      for (let i = start; i <= end; i++) {
                        if (i !== 1 && i !== totalPages) {
                          pages.push(i);
                        }
                      }

                      if (currentPage < totalPages - 2) {
                        pages.push('...');
                      }

                      if (totalPages > 1) {
                        pages.push(totalPages);
                      }
                    }

                    return pages.map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className={styles.ellipsis}>...</span>
                      ) : (
                        <button
                          key={page}
                          className={`${styles.pageNumber} ${currentPage === page ? styles.current : ''}`}
                          onClick={() => setCurrentPage(page as number)}
                        >
                          {page}
                        </button>
                      )
                    ));
                  })()}
                </div>
                <button
                  className={styles.paginationButton}
                  disabled={(() => {
                    // In this block, activeTab is 'data' (not 'text'), so use document page_count
                    const totalPages = (document?.page_count || 1);
                    return currentPage >= totalPages;
                  })()}
                  onClick={() => {
                    // In this block, activeTab is 'data' (not 'text'), so use document page_count
                    const totalPages = (document?.page_count || 1);
                    setCurrentPage(Math.min(totalPages, currentPage + 1));
                  }}
                >
                  Next →
                </button>
              </div>
            ) : null}
          </div>

          {/* Comments Sidebar */}
          <div className={styles.commentsSidebar}>
            <div className={styles.addCommentSection}>
              <h4 className={styles.addCommentTitle}>Add Comment</h4>
              <form onSubmit={handleSubmitComment}>
                <textarea
                  className={styles.commentInput}
                  placeholder="Enter your comment here..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                />
                <button
                  type="submit"
                  className={styles.submitCommentButton}
                  disabled={submittingComment || !newComment.trim()}
                >
                  {submittingComment ? 'Adding...' : 'Add Comment'}
                </button>
              </form>
            </div>

            <div className={styles.commentsHistory}>
              <h4 className={styles.commentsHistoryTitle}>Comment History</h4>
              {loadingComments ? (
                <div className={styles.loadingComments}>Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className={styles.noComments}>No comments yet. Be the first to comment!</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className={styles.commentCard}>
                    <div className={styles.commentHeader}>
                      <div className={styles.commentMeta}>
                        <strong>{comment.user_name}</strong>
                        <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
                      </div>
                    </div>
                    <div className={styles.commentText}>
                      <strong>Comment:</strong> {comment.content}
                    </div>
                    {comment.reply ? (
                      <div className={styles.replySection}>
                        <strong>Reply:</strong>
                        <div className={styles.replyText}>
                          {comment.reply}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.replySection}>
                        <div className={styles.noReply}>Not reply yet.</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {/* Original Images Carousel Popup - Benefits Style */}
      {showOriginalCarousel && relatedImages.length > 0 && (
        <div className={styles.originalCarouselOverlay} onClick={() => setShowOriginalCarousel(false)}>
          <div className={styles.originalCarouselContainer} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.originalCarouselCloseButton}
              onClick={() => setShowOriginalCarousel(false)}
            >
              ×
            </button>
            
            <div className={styles.originalCarouselHeader}>
              <h2 className={styles.originalCarouselTitle}>
                {isGroupView ? 'Original Documents' : 'Original Images'}
              </h2>
              {isGroupView && (
                <p className={styles.originalCarouselSubtitle}>
                  {relatedImages.length} {relatedImages.length === 1 ? 'document' : 'documents'} in this group
                </p>
              )}
            </div>

            <div className={styles.originalCarouselWrapper}>
              {relatedImages.length > 1 && (
                <button
                  className={styles.originalCarouselSideButton}
                  style={{ left: '20px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : relatedImages.length - 1));
                  }}
                  aria-label="Previous document"
                >
                  ←
                </button>
              )}
              <div 
                className={styles.originalCarouselTrack}
                style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
              >
                {relatedImages.map((img, index) => (
                  <div key={img.id} className={styles.originalCarouselCard}>
                    <div className={styles.originalCarouselImageContainer}>
                      <img
                        src={`/api/documents/download/${img.id}`}
                        alt={img.original_name}
                        className={styles.originalCarouselImage}
                        onError={(e) => {
                          console.error('Error loading image');
                          (e.target as HTMLImageElement).src = '/placeholder-image.png';
                        }}
                      />
                    </div>
                    <div className={styles.originalCarouselImageName}>
                      {img.original_name}
                    </div>
                  </div>
                ))}
              </div>
              {relatedImages.length > 1 && (
                <button
                  className={styles.originalCarouselSideButton}
                  style={{ right: '20px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) => (prev < relatedImages.length - 1 ? prev + 1 : 0));
                  }}
                  aria-label="Next document"
                >
                  →
                </button>
              )}
            </div>

            <div className={styles.originalCarouselDots}>
              {relatedImages.map((_, index) => (
                <span
                  key={index}
                  className={currentImageIndex === index ? styles.originalCarouselDotActive : styles.originalCarouselDot}
                  onClick={() => setCurrentImageIndex(index)}
                ></span>
              ))}
            </div>

            {relatedImages.length > 1 && (
              <div className={styles.originalCarouselNavButtons}>
                <button
                  className={styles.originalCarouselNavButton}
                  onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : relatedImages.length - 1))}
                >
                  ← Previous
                </button>
                <button
                  className={styles.originalCarouselNavButton}
                  onClick={() => setCurrentImageIndex((prev) => (prev < relatedImages.length - 1 ? prev + 1 : 0))}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
