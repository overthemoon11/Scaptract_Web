import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Profile.module.css';
import { User, AuthResponse, ApiError } from '@shared/types';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [editForm, setEditForm] = useState({
    name: '',
    email: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setEditForm({
            name: data.user.name,
            email: data.user.email
          });
        } else {
          navigate('/auth/login');
        }
      } catch (err) {
        navigate('/auth/login');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [navigate]);

  if (loading) {
    return <Layout user={user} loading={true} loadingText="Loading" />;
  }
  if (!user) {
    return <Layout user={user} loading={true} loadingText="Redirecting" />;
  }

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setNotification(null);
    if (!isEditing) {
      setEditForm({
        name: user.name,
        email: user.email
      });
    }
  };

  const handlePasswordToggle = () => {
    setIsChangingPassword(!isChangingPassword);
    setNotification(null);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    if (!editForm.name.trim() || !editForm.email.trim()) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Name and email are required'
      });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim()
        }),
      });

      const data: AuthResponse | ApiError = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'error' in data ? data.error : 'Failed to update profile'
        });
      } else {
        if ('user' in data && data.user) {
          setUser(data.user as User);
        }
        setNotification({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile information has been successfully updated!'
        });
        setIsEditing(false);

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Profile Updated! ✅', {
            body: 'Your profile information has been successfully updated.',
            icon: '/favicon.ico'
          });
        }
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Network error. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    if (passwordForm.newPassword.length < 6) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'New password must be at least 6 characters long'
      });
      setIsLoading(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'New passwords do not match'
      });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        }),
      });

      const data: AuthResponse | ApiError = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Update Failed',
          message: 'error' in data ? data.error : 'Failed to update password'
        });
      } else {
        setNotification({
          type: 'success',
          title: 'Password Updated',
          message: 'Your password has been successfully changed!'
        });
        setIsChangingPassword(false);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Password Updated! 🔑', {
            body: 'Your password has been successfully changed.',
            icon: '/favicon.ico'
          });
        }
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Network error. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/auth/login');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Recently';
    return new Date(dateString).toISOString().substring(0, 10);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setNotification({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Only image files (JPG, PNG, GIF, WEBP) are supported'
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setNotification({
        type: 'error',
        title: 'File Too Large',
        message: 'File size must be less than 5MB'
      });
      return;
    }

    setIsUploadingImage(true);
    setNotification(null);

    const formData = new FormData();
    formData.append('profileImage', file);

    try {
      const res = await fetch('/api/profile/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setNotification({
          type: 'error',
          title: 'Upload Failed',
          message: data.error || 'Failed to upload profile image'
        });
      } else {
        // Update user state with new profile image
        if (user) {
          setUser({ ...user, profile_image: data.profile_image });
        }
        setNotification({
          type: 'success',
          title: 'Image Uploaded',
          message: 'Profile image uploaded successfully!'
        });
      }
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Network error. Please try again.'
      });
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const getProfileImageUrl = (profileImage?: string) => {
    if (!profileImage) return null;
    // If it's already a full URL, return as is
    if (profileImage.startsWith('http')) return profileImage;
    // Otherwise, construct the URL from the server
    // Ensure the path starts with /api/uploads/
    if (profileImage.startsWith('uploads/')) {
      return `/api/${profileImage}`;
    }
    return `/api/uploads/${profileImage}`;
  };

  return (
    <Layout user={user}>
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>My Profile</h1>
        
        <div className={styles.profileLayout}>
          <div className={styles.profileLeft}>
            <div className={styles.profileCard} data-tg-tour="👨‍💼 Your Profile - View your account details here. You can edit your name, email, and change your password using the buttons below.">
              <div className={styles.header}>
                <div className={styles.avatarContainer}>
                  <div 
                    className={styles.avatar} 
                    onClick={handleImageClick}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    {user.profile_image ? (
                      <img 
                        src={getProfileImageUrl(user.profile_image) || ''} 
                        alt={user.name}
                        className={styles.avatarImage}
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = getInitials(user.name);
                          }
                        }}
                      />
                    ) : (
                      getInitials(user.name)
                    )}
                    {isUploadingImage && (
                      <div className={styles.uploadOverlay}>
                        <div className={styles.uploadSpinner}>Uploading...</div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick();
                      }}
                      className={styles.cameraButton}
                      disabled={isUploadingImage}
                      title="Upload profile image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                      </svg>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                <h1 className={styles.title}>{user.name}</h1>
                <p className={styles.subtitle}>{user.email}</p>
                <span
                  className={styles.roleTag}
                  style={user.role === 'admin' ? { cursor: 'pointer' } : {}}
                  onClick={() => {
                    if (user.role === 'admin') navigate('/admin/user');
                  }}
                >
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.profileRight}>
            <div className={`${styles.transparentProfileCard} ${isEditing ? styles.editingCard : ''}`}>
          <h2 className={styles.sectionTitle}>Profile Information</h2>
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Username</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className={styles.editInput}
                  required
                  disabled={isLoading}
                  placeholder="Enter your username"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className={styles.editInput}
                  required
                  disabled={isLoading}
                  placeholder="Enter your email address"
                />
              </div>
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handleEditToggle}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Username</div>
                  <div className={styles.infoValue}>{user.name}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Email Address</div>
                  <div className={styles.infoValue}>{user.email}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Account Role</div>
                  <div className={styles.infoValue}>{user.role.toUpperCase()}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Member Since</div>
                  <div className={styles.infoValue}>{formatDate(user.created_at)}</div>
                </div>
              </div>
              <div className={styles.buttonGroup} style={{ paddingRight: '30px', paddingBottom: '30px' }}>
                <button
                  onClick={handleEditToggle}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  data-tg-tour="✏️ Edit Profile - Click 'Edit Profile' to update your name and email address. Changes are saved immediately."
                >
                  Edit Profile
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`${styles.transparentProfileCard} ${isChangingPassword ? styles.editingCard : ''}`}>
          <h2 className={styles.sectionTitle}>Security</h2>
          {isChangingPassword ? (
            <form onSubmit={handlePasswordSubmit} className={styles.editForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className={styles.editInput}
                  required
                  disabled={isLoading}
                  placeholder="Enter your current password"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className={styles.editInput}
                  required
                  minLength={6}
                  disabled={isLoading}
                  placeholder="Enter your new password"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className={styles.editInput}
                  required
                  minLength={6}
                  disabled={isLoading}
                  placeholder="Confirm your new password"
                />
              </div>
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handlePasswordToggle}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.infoItem}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Password Management</div>
              <div style={{ color: '#222', marginBottom: 16 }}>Keep your account secure by regularly updating your password.</div>
              <button
                onClick={handlePasswordToggle}
                className={`${styles.button} ${styles.buttonPrimary}`}
                style={{ marginTop: '30px' }}
                data-tg-tour="🔐 Change Password - Use this button to securely update your password. You'll need to enter your current password for verification."
              >
                Change Password
              </button>
            </div>
          )}
        </div>

              <div className={styles.buttonGroup} style={{ marginBottom: '70px', marginRight: '70px'}}>
                <button
                  onClick={handleLogout}
                  className={`${styles.button} ${styles.buttonDanger}`}
                >
                  Logout
                </button>
              </div>
          </div>
        </div>

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

