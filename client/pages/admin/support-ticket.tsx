import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import styles from '@/styles/AdminUser.module.css';
import { User } from '@shared/types';

interface TicketListItem {
  id: string;
  _id?: string;
  title: string;
  description: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function AdminSupportTicketPage() {
  const [user, setUser] = useState<User | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localTickets, setLocalTickets] = useState<TicketListItem[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  // Fetch user and tickets
  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        const ticketsRes = await fetch('/api/admin/support-tickets', { credentials: 'include' });
        const ticketsData = await ticketsRes.json();
        if (ticketsData.tickets) {
          setLocalTickets(ticketsData.tickets);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Apply filters when localTickets or filter values change
  useEffect(() => {
    const ticketsToFilter = Array.isArray(localTickets) ? localTickets : [];

    if (!ticketsToFilter || ticketsToFilter.length === 0) {
      setFilteredTickets([]);
      return;
    }

    let filtered = [...ticketsToFilter];

    // Apply search filter (title, description)
    if (searchQuery.trim()) {
      filtered = filtered.filter(t => {
        const title = (t.title || '').toLowerCase();
        const description = (t.description || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return title.includes(query) || description.includes(query);
      });
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(t => {
        const status = (t.status || 'pending').toLowerCase();
        return selectedStatuses.map(s => s.toLowerCase()).includes(status);
      });
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(t => {
        if (!t.createdAt) return false;
        const ticketDate = new Date(t.createdAt);
        const filterDate = new Date(selectedDate);
        return ticketDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredTickets(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [localTickets, searchQuery, selectedStatuses, selectedDate]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  // Generate pagination buttons
  const renderPagination = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
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

      // Show last page
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

  const handleStatusChange = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/admin/support-ticket/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'solved' })
      });

      if (response.ok) {
        // Update local state
        setLocalTickets(prev =>
          prev.map(t => (t.id === ticketId || t._id === ticketId ? { ...t, status: 'solved' } : t))
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update ticket status');
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
      alert('Failed to update ticket status. Please try again.');
    }
  };

  const handleFilterToggle = () => {
    setFilterOpen(!filterOpen);
  };

  const handleStatusFilterChange = (status: string) => {
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

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.userContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            <div className={styles.headerSection}>
              <h1 className={styles.mainTitle}>Support Ticket Overview</h1>
            </div>

            <div className={styles.filterSection}>
              <button className={styles.filterButton} onClick={handleFilterToggle}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.filterIcon} viewBox="0 0 16 16">
                  <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5zm1 .5v1.308l4.372 4.858A.5.5 0 0 1 7 8.5v5.306l2-.666V8.5a.5.5 0 0 1 .128-.334L13.5 3.308V2z" />
                </svg>
                Filter by
              </button>
            </div>

            <div className={styles.tableContainer} data-tg-tour="📞 Support Management - View all support tickets, assign them to staff, and respond to customer inquiries.">
              <table className={styles.userTable}>
                <thead>
                  <tr>
                    <th>Ticket title</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.noUsers}>
                        No support tickets found
                      </td>
                    </tr>
                  ) : (
                    paginatedTickets.map(t => (
                      <tr key={t.id || t._id} className={styles.tableRow}>
                        <td className={styles.userCell}>
                          <div className={styles.userName}>{t.title}</div>
                        </td>
                        <td className={styles.emailCell}>
                          {t.description && t.description.length > 100
                            ? `${t.description.substring(0, 100)}...`
                            : t.description}
                        </td>
                        <td>
                          <span className={t.status === 'solved' ? styles.statusActive : styles.statusBanned}>
                            {t.status === 'solved' ? 'Solved' : 'Pending'}
                          </span>
                        </td>
                        <td className={styles.dateCell}>
                          {formatDate(t.createdAt)}
                        </td>
                        <td className={styles.actionCell}>
                          {t.status === 'pending' ? (
                            <button
                              className={styles.activateButton}
                              onClick={() => handleStatusChange(t.id || t._id || '')}
                              title="Mark as Solved"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                                <path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05" />
                              </svg>
                            </button>
                          ) : (
                            <span style={{ color: '#999' }}>Solved</span>
                          )}
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

                {/* Status */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Status</label>
                  <div className={styles.checkboxGroup}>
                    {['Pending', 'Solved'].map(status => (
                      <label key={status} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => handleStatusFilterChange(status)}
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
