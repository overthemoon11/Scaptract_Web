import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import styles from '@/styles/AdminUser.module.css';
import { User } from '@shared/types';

interface CommentListItem {
  id: string;
  content: string;
  reply?: string | null;
  document_id: string;
  created_at?: string | null;
}

interface DocumentInfo {
  id: string;
  file_name?: string;
  original_name?: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function CommentOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localComments, setLocalComments] = useState<CommentListItem[]>([]);
  const [filteredComments, setFilteredComments] = useState<CommentListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        if (id) {
          const commentsRes = await fetch(`/api/admin/document/comments/${id}`, { credentials: 'include' });
          const commentsData = await commentsRes.json();
          if (commentsData.document) {
            setDocument(commentsData.document);
          }
          if (commentsData.comments) {
            setLocalComments(commentsData.comments);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);


  useEffect(() => {
    const commentsToFilter = Array.isArray(localComments) ? localComments : [];

    if (!commentsToFilter || commentsToFilter.length === 0) {
      setFilteredComments([]);
      return;
    }

    let filtered = [...commentsToFilter];

    if (searchQuery.trim()) {
      filtered = filtered.filter(c => {
        const content = (c.content || '').toLowerCase();
        const reply = (c.reply || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return content.includes(query) || reply.includes(query);
      });
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(c => {
        const status = c.reply ? 'Done' : 'Pending';
        return selectedStatuses.includes(status);
      });
    }

    if (selectedDate) {
      filtered = filtered.filter(c => {
        if (!c.created_at) return false;
        const commentDate = new Date(c.created_at);
        const filterDate = new Date(selectedDate);
        return commentDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredComments(filtered);
    setCurrentPage(1);
  }, [localComments, searchQuery, selectedStatuses, selectedDate]);

  const totalPages = Math.ceil(filteredComments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedComments = filteredComments.slice(startIndex, endIndex);

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
    setSelectedStatuses([]);
    setSelectedDate('');
  };

  const handleEditClick = (commentId: string, documentId: string) => {
    navigate(`/admin/document/comments/edit/${commentId}`);
  };

  const truncateText = (text?: string | null, maxLength: number = 50): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '.....';
  };

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.userContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            <div className={styles.headerSection}>
              <h1 className={styles.mainTitle}>
                Comment Overview - {document?.file_name || document?.original_name || 'Unknown Document'}
              </h1>
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
                    <th>Comment</th>
                    <th>Reply</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedComments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.noUsers}>
                        No comments found
                      </td>
                    </tr>
                  ) : (
                    paginatedComments.map(comment => (
                      <tr key={comment.id} className={styles.tableRow}>
                        <td className={styles.userCell}>
                          <div className={styles.userName}>
                            {truncateText(comment.content)}
                          </div>
                        </td>
                        <td className={styles.emailCell}>
                          {comment.reply ? truncateText(comment.reply) : 'Not reply yet.'}
                        </td>
                        <td>
                          <span className={comment.reply ? styles.statusActive : styles.statusBanned}>
                            {comment.reply ? 'Done' : 'Pending'}
                          </span>
                        </td>
                        <td className={styles.dateCell}>
                          {formatDate(comment.created_at)}
                        </td>
                        <td className={styles.actionCell}>
                          <button
                            className={styles.activateButton}
                            onClick={() => handleEditClick(comment.id, comment.document_id)}
                            title="Edit Reply"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                              <path fillRule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
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

                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Status</label>
                  <div className={styles.checkboxGroup}>
                    {['Done', 'Pending'].map(status => (
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
