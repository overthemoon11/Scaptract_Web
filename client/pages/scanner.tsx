import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Scanner.module.css';
import { User } from '@shared/types';

interface DocumentListItem {
  id: string;
  original_name?: string;
  file_name?: string;
  file_id?: string | null;
  group_name?: string | null;
  display_name?: string | null;
  mime_type?: string;
  page_count?: number;
  status: string;
  file_type_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GroupedDocument {
  group_name: string;
  documents: DocumentListItem[];
  firstDocumentId: string;
  totalPages: number;
  fileType: string;
  latestDate: string;
  isMultiple: boolean;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getFileType(mimeType?: string, fileName?: string, fileTypeName?: string | null): string {
  if (fileTypeName) return fileTypeName.toUpperCase();
  if (mimeType) {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) {
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPG';
      if (mimeType.includes('png')) return 'PNG';
      return 'IMG';
    }
    if (mimeType.includes('word') || mimeType.includes('document')) return 'DOCX';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLSX';
  }
  const ext = fileName?.split('.').pop()?.toUpperCase();
  return ext || 'FILE';
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localDocuments, setLocalDocuments] = useState<DocumentListItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10; // Show 10 group documents per page
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editedGroupName, setEditedGroupName] = useState<string>('');
  const [savingGroupName, setSavingGroupName] = useState(false);
  const prevFiltersRef = useRef<{ searchQuery: string; selectedFileTypes: string[]; selectedDate: string } | null>(null);

  // Get page from URL params
  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    setCurrentPage(page);
  }, [searchParams]);

  // Fetch user and documents
  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        // Fetch all documents to allow proper grouping and client-side pagination
        // We'll fetch a large batch to ensure we have enough documents for grouping
        const documentsRes = await fetch(`/api/documents/user-documents?page=1&limit=10000`, { credentials: 'include' });
        const documentsData = await documentsRes.json();
        if (documentsData.documents) {
          setLocalDocuments(documentsData.documents);
          // totalPages will be calculated after grouping
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [searchParams]);

  // Apply filters when localDocuments or filter values change
  useEffect(() => {
    const docsToFilter = Array.isArray(localDocuments) ? localDocuments : [];

    if (!docsToFilter || docsToFilter.length === 0) {
      setFilteredDocuments([]);
      setTotalPages(0);
      return;
    }

    let filtered = [...docsToFilter];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc => {
        const searchText = doc.display_name || doc.group_name || doc.original_name || doc.file_name || '';
        return searchText.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Apply file type filter (only if file types are selected)
    if (selectedFileTypes.length > 0) {
      filtered = filtered.filter(doc => {
        const fileType = doc.file_type_name || getFileType(doc.mime_type, doc.original_name || doc.file_name);
        return selectedFileTypes.includes(fileType.toUpperCase());
      });
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(doc => {
        if (!doc.updated_at) return false;
        const docDate = new Date(doc.updated_at);
        const filterDate = new Date(selectedDate);
        return docDate.toDateString() === filterDate.toDateString();
      });
    }

    // Group documents by group_name (documents uploaded together)
    const groupedMap = new Map<string, DocumentListItem[]>();
    
    filtered.forEach(doc => {
      // Use group_name as key, fallback to id for unique documents without group_name
      const key = doc.group_name || doc.id;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key)!.push(doc);
    });

    // Convert grouped map to array of grouped documents
    const grouped: GroupedDocument[] = Array.from(groupedMap.entries()).map(([group_name, documents]) => {
      // Sort documents by created_at to get the first one
      const sortedDocs = [...documents].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      });

      const firstDoc = sortedDocs[0];
      // Sum up page_count from all documents in the group, defaulting to 0 if not set
      const totalPages = documents.reduce((sum, doc) => sum + (doc.page_count || 0), 0);
      const fileType = firstDoc.file_type_name || getFileType(firstDoc.mime_type, firstDoc.original_name || firstDoc.file_name);
      
      // Get latest updated_at date
      const dates = documents
        .map(doc => doc.updated_at ? new Date(doc.updated_at).getTime() : 0)
        .filter(date => date > 0);
      const latestDate = dates.length > 0 
        ? new Date(Math.max(...dates)).toISOString() 
        : (firstDoc.updated_at || firstDoc.created_at || '');

      return {
        group_name: group_name,
        documents: sortedDocs,
        firstDocumentId: firstDoc.id,
        totalPages,
        fileType,
        latestDate,
        isMultiple: documents.length > 1
      };
    });

    // Sort grouped documents by latest date (most recent first)
    grouped.sort((a, b) => {
      const dateA = new Date(a.latestDate).getTime();
      const dateB = new Date(b.latestDate).getTime();
      return dateB - dateA;
    });

    // Convert grouped documents to display format
    const displayDocuments = grouped.map(group => {
      const firstDoc = group.documents[0];
      // Use display_name if available, otherwise use group_name
      const displayName = firstDoc.display_name || group.group_name;
      return {
        ...firstDoc, // Use first document as base
        _grouped: group.isMultiple, // Only true if multiple documents
        _groupSize: group.documents.length,
        _totalPages: group.totalPages,
        _fileType: group.fileType,
        _latestDate: group.latestDate,
        _group_name: group.group_name, // Keep system group_name for navigation
        _display_name: displayName, // User-friendly display name
        file_id: firstDoc?.file_id || null // Preserve file_id for deletion
      };
    });

    setFilteredDocuments(displayDocuments as any);
    
    // Calculate total pages based on grouped documents
    const groupedTotalPages = Math.ceil(displayDocuments.length / itemsPerPage);
    setTotalPages(groupedTotalPages);
    
    // Only reset to page 1 when filters/search actually change, not on page navigation
    const filtersChanged = prevFiltersRef.current === null ||
      prevFiltersRef.current.searchQuery !== searchQuery ||
      JSON.stringify(prevFiltersRef.current.selectedFileTypes) !== JSON.stringify(selectedFileTypes) ||
      prevFiltersRef.current.selectedDate !== selectedDate;
    
    if (filtersChanged) {
      // Only reset to page 1 if filters actually changed (not on initial load if no filters)
      if (prevFiltersRef.current !== null) {
        setCurrentPage(1);
        setSearchParams({ page: '1' });
      }
      // Update ref to track current filter state
      prevFiltersRef.current = {
        searchQuery,
        selectedFileTypes,
        selectedDate
      };
    }
  }, [localDocuments, searchQuery, selectedFileTypes, selectedDate, setSearchParams]);
  
  // Separate effect to ensure current page doesn't exceed total pages
  // Only redirect if currentPage is definitely invalid (more than totalPages)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      // Only redirect if we're definitely on an invalid page
      const validPage = Math.max(1, totalPages);
      setCurrentPage(validPage);
      setSearchParams({ page: validPage.toString() });
    }
  }, [totalPages, currentPage, setSearchParams]);

  const handleDocumentClick = (document: any) => {
    // Don't navigate if clicking on edit controls
    if (editingGroupName === (document._group_name || document.group_name)) {
      return;
    }
    // For grouped documents with multiple files, navigate to group view
    // For single documents, navigate to individual document view
    if (document._grouped && document._groupSize > 1 && document._group_name) {
      navigate(`/documents/view/group/${encodeURIComponent(document._group_name)}`);
    } else {
      // Extract the document ID from the document object
      const documentId = document?.id || document?.firstDocumentId;
      if (documentId) {
        navigate(`/documents/view/${documentId}`);
      }
    }
  };

  const handleEditGroupName = (e: React.MouseEvent, groupName: string, currentDisplayName: string) => {
    e.stopPropagation();
    setEditingGroupName(groupName);
    setEditedGroupName(currentDisplayName || groupName);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupName(null);
    setEditedGroupName('');
  };

  const handleSaveGroupName = async (e: React.MouseEvent | React.KeyboardEvent, systemGroupName: string) => {
    e.stopPropagation();
    
    if (!editedGroupName.trim()) {
      setNotification({
        type: 'error',
        title: 'Invalid Name',
        message: 'Group name cannot be empty'
      });
      return;
    }

    if (editedGroupName.trim() === (editingGroupName || '')) {
      setEditingGroupName(null);
      setEditedGroupName('');
      return;
    }

    setSavingGroupName(true);
    try {
      const response = await fetch('/api/documents/group/update-name', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          oldGroupName: systemGroupName,
          newGroupName: editedGroupName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update group name');
      }

      // Refresh documents to get updated display_name
      // Fetch all documents (limit=10000) to allow proper grouping and client-side pagination
      const documentsRes = await fetch(`/api/documents/user-documents?page=1&limit=10000`, { credentials: 'include' });
      const documentsData = await documentsRes.json();
      if (documentsData.documents) {
        setLocalDocuments(documentsData.documents);
        // totalPages will be calculated after grouping in the filtering effect
      }

      setEditingGroupName(null);
      setEditedGroupName('');
      
      setNotification({
        type: 'success',
        title: 'Success',
        message: 'Group name updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating group name:', error);
      setNotification({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to update group name'
      });
    } finally {
      setSavingGroupName(false);
    }
  };

  const handleDeleteDocument = async (document: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click event
    
    // Get file_id from the document (preferred) or use document id as fallback
    const fileId = document.file_id;
    const documentId = document.id;
    
    if (!fileId && !documentId) {
      setNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Cannot delete: file_id or document id not found'
      });
      return;
    }

    // Get document count for confirmation message
    const isGrouped = document._grouped === true;
    const groupSize = document._groupSize || 1;
    const confirmMessage = isGrouped && groupSize > 1
      ? `Are you sure you want to delete this document batch (${groupSize} files)? This action cannot be undone.`
      : 'Are you sure you want to delete this document? This action cannot be undone.';

    // Show confirmation popup
    setNotification({
      type: 'warning',
      title: 'Confirm Delete',
      message: confirmMessage,
      onConfirm: async () => {
        setNotification(null);
        await executeDelete(fileId, documentId);
      },
      onCancel: () => {
        setNotification(null);
      }
    });
  };

  const executeDelete = async (fileId?: string, documentId?: string) => {
    try {
      setLoading(true);
      // Use file_id if available, otherwise use document id
      const queryParam = fileId ? `file_id=${encodeURIComponent(fileId)}` : `id=${encodeURIComponent(documentId!)}`;
      const response = await fetch(`/api/documents/delete?${queryParam}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }

      const result = await response.json();
      
      // Refresh the document list
      // Fetch all documents (limit=10000) to allow proper grouping and client-side pagination
      const documentsRes = await fetch(`/api/documents/user-documents?page=1&limit=10000`, { credentials: 'include' });
      const documentsData = await documentsRes.json();
      if (documentsData.documents) {
        setLocalDocuments(documentsData.documents);
        // totalPages will be calculated after grouping in the filtering effect
      }
      
      // Show success message
      const message = result.deletedCount > 1 
        ? `Successfully deleted ${result.deletedCount} documents and all related data`
        : `Successfully deleted document and all related data`;
      
      setNotification({
        type: 'success',
        title: 'Delete Successful',
        message: message
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      setNotification({
        type: 'error',
        title: 'Delete Failed',
        message: error.message || 'Unknown error occurred while deleting the document'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSearchParams({ page: page.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterToggle = () => {
    setFilterOpen(!filterOpen);
  };

  const handleFileTypeChange = (fileType: string) => {
    setSelectedFileTypes(prev => {
      if (prev.includes(fileType)) {
        return prev.filter(type => type !== fileType);
      } else {
        return [...prev, fileType];
      }
    });
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedFileTypes([]);
    setSelectedDate('');
  };

  // Generate pagination buttons
  const renderPagination = () => {
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

    return pages;
  };

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div data-tg-tour="🔍 Document Scanning - Here you can scan new documents. Upload files or use live camera scanning. The system will extract text using OCR technology." className={styles.scannerContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            <div className={styles.headerSection}>
              <h1 className={styles.mainTitle}>My Documents</h1>
            </div>

            <div className={styles.filterSection}>
              <button className={styles.filterButton} onClick={handleFilterToggle}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.filterIcon} viewBox="0 0 16 16">
                  <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
                </svg>
                Filter by
              </button>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.documentsTable}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Page</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.noDocuments}>
                        No documents found
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      // Client-side pagination for grouped documents
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedGroupDocuments = filteredDocuments.slice(startIndex, endIndex);
                      
                      return paginatedGroupDocuments.map((document: any) => {
                      const isGrouped = document._grouped === true;
                      const groupSize = document._groupSize || 1;
                      // Use display_name if available, otherwise group_name, otherwise file_name
                      const displayName = document._display_name || document.display_name || document._group_name || document.group_name || document.file_name || 'Untitled Document';
                      // Check if document has an actual group_name from database (not a document ID used as fallback)
                      // group_name values are generated as "group-{timestamp}-{random}" so they start with "group-"
                      const hasGroupName = document.group_name && typeof document.group_name === 'string' && document.group_name.startsWith('group-');
                      const systemGroupName = hasGroupName ? document.group_name : null; // Use actual group_name from database for editing
                      const fileTypeName = document._fileType || document.file_type_name || getFileType(document.mime_type, displayName);
                      // For grouped documents, use _totalPages; for single documents, use page_count directly
                      const totalPages = document._totalPages !== undefined 
                        ? document._totalPages 
                        : (document.page_count !== undefined && document.page_count !== null ? document.page_count : 0);
                      const status = document.status || 'uploaded';
                      const displayDate = document._latestDate || document.updated_at;
                      
                      // Format status for display
                      const formatStatus = (status: string): string => {
                        return status.charAt(0).toUpperCase() + status.slice(1);
                      };

                      return (
                        <tr
                          key={document.id}
                          onClick={() => handleDocumentClick(document)}
                        >
                          <td className={styles.fileName} data-label="">
                            <div className={styles.fileNameContainer}>
                              {editingGroupName === systemGroupName && systemGroupName ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                  <input
                                    type="text"
                                    value={editedGroupName}
                                    onChange={(e) => setEditedGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveGroupName(e, systemGroupName);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEdit(e as any);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={savingGroupName}
                                    style={{
                                      flex: 1,
                                      padding: '4px 8px',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      fontSize: 'inherit'
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => handleSaveGroupName(e, systemGroupName)}
                                    disabled={savingGroupName}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      padding: 0,
                                      backgroundColor: '#4CAF50',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '50%',
                                      cursor: savingGroupName ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '16px'
                                    }}
                                    title="Save"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    disabled={savingGroupName}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      padding: 0,
                                      backgroundColor: '#f44336',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '50%',
                                      cursor: savingGroupName ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '16px'
                                    }}
                                    title="Cancel"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={styles.fileNameText}>
                                    {displayName}
                                    {isGrouped && groupSize > 1 && (
                                      <span className={styles.groupBadge}>
                                        {' '}({groupSize} {groupSize === 1 ? 'file' : 'files'})
                                      </span>
                                    )}
                                  </span>
                                  {systemGroupName && hasGroupName && (
                                    <button
                                      onClick={(e) => handleEditGroupName(e, systemGroupName, displayName)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        fontSize: '14px',
                                        color: '#666',
                                        opacity: 0.7
                                      }}
                                      title="Edit group name"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={styles.pageCount} data-label="Page:">{totalPages}</td>
                          <td className={styles.fileType} data-label="Type:">{fileTypeName}</td>
                          <td className={styles.status} data-label="Status:">
                            <span className={`${styles.statusBadge} ${styles[`status${formatStatus(status)}`] || ''}`}>
                              {formatStatus(status)}
                            </span>
                          </td>
                          <td className={styles.date} data-label="Date:">{formatDate(displayDate)}</td>
                          <td className={styles.action} data-label="Action:">
                            <button
                              className={styles.deleteButton}
                              onClick={(e) => handleDeleteDocument(document, e)}
                              title="Delete document"
                              aria-label="Delete document"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.paginationButton}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <div className={styles.pageNumbers}>
                  {renderPagination().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className={styles.ellipsis}>...</span>
                    ) : (
                      <button
                        key={page}
                        className={`${styles.pageNumber} ${currentPage === page ? styles.current : ''}`}
                        onClick={() => handlePageChange(page as number)}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>
                <button
                  className={styles.paginationButton}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Filter Overlay */}
          {filterOpen && (
            <div className={styles.filterOverlay} onClick={handleFilterToggle}></div>
          )}

          {/* Filter Sidebar */}
          {filterOpen && (
            <div className={styles.filterSidebar}>
              <div className={styles.filterHeader}>
                <h2 className={styles.filterTitle}>Filter</h2>
                <button className={styles.closeButton} onClick={handleFilterToggle}>×</button>
              </div>

              <div className={styles.filterContent}>
                {/* Search */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}></label>
                  <div className={styles.searchInputWrapper}>
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.searchIcon} viewBox="0 0 16 16">
                      <path d="M6.5 4.482c1.664-1.673 5.825 1.254 0 5.018-5.825-3.764-1.664-6.69 0-5.018" />
                      <path d="M13 6.5a6.47 6.47 0 0 1-1.258 3.844q.06.044.115.098l3.85 3.85a1 1 0 0 1-1.414 1.415l-3.85-3.85a1 1 0 0 1-.1-.115h.002A6.5 6.5 0 1 1 13 6.5M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11" />
                    </svg>
                  </div>
                </div>

                {/* File Type */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>File Type</label>
                  <div className={styles.checkboxGroup}>
                    {['PDF', 'PNG', 'JPG', 'JPEG'].map(type => (
                      <label key={type} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedFileTypes.includes(type)}
                          onChange={() => handleFileTypeChange(type)}
                          className={styles.checkbox}
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Date</label>
                  <div className={styles.dateInputWrapper}>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.calendarIcon} viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM1 14V4h14v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1m7-6.507c1.664-1.711 5.825 1.283 0 5.132-5.825-3.85-1.664-6.843 0-5.132" />
                    </svg>
                  </div>
                </div>

                {/* Clear All Filters Button */}
                <div className={styles.filterGroup}>
                  <button className={styles.clearAllButton} onClick={handleClearAllFilters}>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {notification && (
        <NotificationCard
          type={notification.type}
          title={notification.title}
          message={notification.message}
          primaryButtonText={notification.onConfirm ? 'Confirm' : 'OK'}
          secondaryButtonText={notification.onCancel ? 'Cancel' : undefined}
          onPrimaryClick={() => {
            if (notification.onConfirm) {
              notification.onConfirm();
            } else {
              setNotification(null);
            }
          }}
          onSecondaryClick={() => {
            if (notification.onCancel) {
              notification.onCancel();
            } else {
              setNotification(null);
            }
          }}
          onClose={() => setNotification(null)}
        />
      )}
    </Layout>
  );
}
