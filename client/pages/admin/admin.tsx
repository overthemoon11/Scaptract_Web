import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import styles from '@/styles/AdminUser.module.css';
import { User } from '@shared/types';

interface AdminListItem {
  id: string;
  _id?: string;
  name: string;
  email: string;
  status: string;
  createdAt?: string | null;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export default function AdminAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localAdmins, setLocalAdmins] = useState<AdminListItem[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<AdminListItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  // Fetch user and admins
  useEffect(() => {
    async function fetchData() {
      try {
        const userRes = await fetch('/api/profile', { credentials: 'include' });
        const userData = await userRes.json();
        if (userData.user) {
          setUser(userData.user);
        }

        const adminsRes = await fetch('/api/admin/admins', { credentials: 'include' });
        const adminsData = await adminsRes.json();
        if (adminsData.admins) {
          setLocalAdmins(adminsData.admins);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Apply filters when localAdmins or filter values change
  useEffect(() => {
    const adminsToFilter = Array.isArray(localAdmins) ? localAdmins : [];

    if (!adminsToFilter || adminsToFilter.length === 0) {
      setFilteredAdmins([]);
      return;
    }

    let filtered = [...adminsToFilter];

    // Apply search filter (name, id, email)
    if (searchQuery.trim()) {
      filtered = filtered.filter(a => {
        const name = (a.name || '').toLowerCase();
        const email = (a.email || '').toLowerCase();
        const adminId = (a._id || a.id || '').toString().toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || email.includes(query) || adminId.includes(query);
      });
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(a => {
        const status = (a.status || 'active').toLowerCase();
        return selectedStatuses.map(s => s.toLowerCase()).includes(status);
      });
    }

    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(a => {
        if (!a.createdAt) return false;
        const adminDate = new Date(a.createdAt);
        const filterDate = new Date(selectedDate);
        return adminDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredAdmins(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [localAdmins, searchQuery, selectedStatuses, selectedDate]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAdmins = filteredAdmins.slice(startIndex, endIndex);

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

  const handleBanAdmin = async (adminId: string) => {
    try {
      const response = await fetch(`/api/admin/user/${adminId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        setLocalAdmins(prev =>
          prev.map(a => (a.id === adminId || a._id === adminId ? { ...a, status: 'banned' } : a))
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to ban admin');
      }
    } catch (error) {
      console.error('Error banning admin:', error);
      alert('Failed to ban admin. Please try again.');
    }
  };

  const handleActivateAdmin = async (adminId: string) => {
    try {
      const response = await fetch(`/api/admin/user/${adminId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        setLocalAdmins(prev =>
          prev.map(a => (a.id === adminId || a._id === adminId ? { ...a, status: 'active' } : a))
        );
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to activate admin');
      }
    } catch (error) {
      console.error('Error activating admin:', error);
      alert('Failed to activate admin. Please try again.');
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

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.userContainer}>
        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            <div className={styles.headerSection}>
              <h1 className={styles.mainTitle}>Admin Overview</h1>
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
                    <th>Admin</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.noUsers}>
                        No admins found
                      </td>
                    </tr>
                  ) : (
                    paginatedAdmins.map(a => (
                      <tr key={a.id || a._id} className={styles.tableRow}>
                        <td className={styles.userCell}>
                          <div className={styles.userInfo}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className={styles.personIcon} viewBox="0 0 16 16">
                              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
                            </svg>
                            <div>
                              <div className={styles.userName}>{a.name}</div>
                              <div className={styles.userId}>Admin ID: {a._id || a.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.emailCell}>{a.email}</td>
                        <td>
                          <span className={a.status === 'active' ? styles.statusActive : styles.statusBanned}>
                            {a.status === 'active' ? 'Active' : 'Ban'}
                          </span>
                        </td>
                        <td className={styles.dateCell}>
                          {formatDate(a.createdAt)}
                        </td>
                        <td className={styles.actionCell}>
                          {a.status === 'active' ? (
                            <button
                              className={styles.banButton}
                              onClick={() => handleBanAdmin(a.id || a._id || '')}
                              title="Ban Admin"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                                <path d="M11.354 4.646a.5.5 0 0 0-.708 0l-6 6a.5.5 0 0 0 .708.708l6-6a.5.5 0 0 0 0-.708" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              className={styles.activateButton}
                              onClick={() => handleActivateAdmin(a.id || a._id || '')}
                              title="Activate Admin"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                                <path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05" />
                              </svg>
                            </button>
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
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                    </svg>
                  </div>
                </div>

                {/* Status */}
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Status</label>
                  <div className={styles.checkboxGroup}>
                    {['Active', 'Banned'].map(status => (
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
                      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
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
