import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import styles from '@/styles/AdminUser.module.css';
import { User } from '@shared/types';
import Loading from '@/components/Loading';

interface DocumentListItem {
  id: string;
  file_name?: string;
  original_name?: string;
  group_name?: string | null;
  display_name?: string | null;
  file_type_name?: string | null;
  mime_type?: string;
  status: string;
  user_id: string;
  user_name: string;
  created_at?: string | null;
  page_count?: number;
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
  }
  const ext = fileName?.split('.').pop()?.toUpperCase();
  return ext || 'FILE';
}

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    'completed': 'Done',
    'failed': 'Failed',
    'processing': 'Processing',
    'uploaded': 'Uploaded'
  };
  return statusMap[status] || status;
}

export default function AdminDocumentPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localDocuments, setLocalDocuments] = useState<DocumentListItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  // Fetch user and documents
  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        const documentsRes = await fetch('/api/admin/documents', { credentials: 'include' });
        const documentsData = await documentsRes.json();
        if (documentsData.documents) {
          setLocalDocuments(documentsData.documents);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Apply filters when localDocuments or filter values change
  useEffect(() => {
    const docsToFilter = Array.isArray(localDocuments) ? localDocuments : [];

    if (!docsToFilter || docsToFilter.length === 0) {
      setFilteredDocuments([]);
      return;
    }

    let filtered = [...docsToFilter];

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
    const grouped: Array<{ group_name: string; documents: DocumentListItem[]; firstDocumentId: string; totalPages: number; fileType: string; latestDate: string; isMultiple: boolean }> = Array.from(groupedMap.entries()).map(([group_name, documents]) => {
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
        .map(doc => doc.created_at ? new Date(doc.created_at).getTime() : 0)
        .filter(date => date > 0);
      const latestDate = dates.length > 0 
        ? new Date(Math.max(...dates)).toISOString() 
        : (firstDoc.created_at || '');

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
      };
    });

    // Apply all filters to the grouped documents
    let finalFiltered = displayDocuments;
    
    // Apply search filter (document name, display name, group name, user name, user id)
    if (searchQuery.trim()) {
      finalFiltered = finalFiltered.filter((doc: any) => {
        const docName = (doc._display_name || doc.display_name || doc._group_name || doc.group_name || doc.file_name || doc.original_name || '').toLowerCase();
        const userName = (doc.user_name || '').toLowerCase();
        const userId = (doc.user_id || '').toString().toLowerCase();
        const query = searchQuery.toLowerCase();
        return docName.includes(query) || userName.includes(query) || userId.includes(query);
      });
    }

    // Apply file type filter
    if (selectedTypes.length > 0) {
      finalFiltered = finalFiltered.filter((doc: any) => {
        const fileType = doc._fileType || getFileType(doc.mime_type, doc.file_name || doc.original_name, doc.file_type_name);
        return selectedTypes.map(t => t.toUpperCase()).includes(fileType);
      });
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      finalFiltered = finalFiltered.filter((doc: any) => {
        const statusDisplay = getStatusDisplay(doc.status || 'uploaded');
        return selectedStatuses.includes(statusDisplay);
      });
    }

    // Apply date filter
    if (selectedDate) {
      finalFiltered = finalFiltered.filter((doc: any) => {
        const dateToCheck = doc._latestDate || doc.created_at;
        if (!dateToCheck) return false;
        const docDate = new Date(dateToCheck);
        const filterDate = new Date(selectedDate);
        return docDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredDocuments(finalFiltered as any);
    setCurrentPage(1);
  }, [localDocuments, searchQuery, selectedTypes, selectedStatuses, selectedDate]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

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

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFilterToggle = () => {
    setFilterOpen(!filterOpen);
  };

  const handleTypeChange = (type: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedDate('');
  };

  const handleCommentClick = (documentId: string) => {
    navigate(`/admin/document/comments/${documentId}`);
  };

  const handleEditDocument = (documentId: string) => {
    navigate(`/admin/document/edit/${documentId}`);
  };

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.userContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            <div className={styles.headerSection}>
              <h1 className={styles.mainTitle}>Document Overview</h1>
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
              <table className={styles.userTable}>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.noUsers}>
                        No documents found
                      </td>
                    </tr>
                  ) : (
                    paginatedDocuments.map((doc: any) => {
                      const isGrouped = doc._grouped === true;
                      const groupSize = doc._groupSize || 1;
                      // Use display_name if available, otherwise group_name, otherwise file_name
                      const displayName = doc._display_name || doc.display_name || doc._group_name || doc.group_name || doc.file_name || doc.original_name || 'Untitled';
                      
                      return (
                      <tr key={doc.id} className={styles.tableRow}>
                        <td className={styles.userCell}>
                          <div className={styles.userName}>
                            {displayName}
                            {isGrouped && groupSize > 1 && (
                              <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9em' }}>
                                ({groupSize} {groupSize === 1 ? 'file' : 'files'})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.userCell}>
                          <div className={styles.userInfo}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.personIcon} viewBox="0 0 16 16">
                              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
                            </svg>
                            <div>
                              <div className={styles.userName}>{doc.user_name || 'Unknown'}</div>
                              <div className={styles.userId}>User ID: {doc.user_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.emailCell}>
                          {doc._fileType || getFileType(doc.mime_type, doc.file_name || doc.original_name, doc.file_type_name)}
                        </td>
                        <td>
                          <span className={
                            doc.status === 'completed' ? styles.statusActive :
                              doc.status === 'failed' ? styles.statusBanned :
                                styles.statusActive
                          }>
                            {getStatusDisplay(doc.status)}
                          </span>
                        </td>
                        <td className={styles.dateCell}>
                          {formatDate(doc.created_at)}
                        </td>
                        <td className={styles.actionCell}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              className={styles.banButton}
                              onClick={() => handleEditDocument(doc.id)}
                              title="Edit Document"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-pencil-square" viewBox="0 0 16 16">
                                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                                <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"/>
                              </svg>
                            </button>
                            <button
                              className={styles.banButton}
                              onClick={() => handleCommentClick(doc.id)}
                              title="View Comments"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                                <path fillRule="evenodd" d="M2.965 12.695a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2m-.8 3.108.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125M8 5.993c1.664-1.711 5.825 1.283 0 5.132-5.825-3.85-1.664-6.843 0-5.132" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
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
                      placeholder="Search"
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
                  <label className={styles.filterLabel}>Type</label>
                  <div className={styles.checkboxGroup}>
                    {['PDF', 'PNG', 'JPG', 'JPEG'].map(type => (
                      <label key={type} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(type)}
                          onChange={() => handleTypeChange(type)}
                          className={styles.checkbox}
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Status</label>
                  <div className={styles.checkboxGroup}>
                    {['Done', 'Failed', 'Processing', 'Uploaded'].map(status => (
                      <label key={status} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => handleStatusChange(status)}
                          className={styles.checkbox}
                        />
                        <span>{status}</span>
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
    </Layout>
  );
}
