import { useEffect, useState, useRef } from 'react';
import Layout from '@/components/Layout';
import NotificationCard, { NotificationType } from '@/components/NotificationCard';
import styles from '@/styles/Documents.module.css';
import { User } from '@shared/types';

interface FileData {
  id: number;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
}

interface UploadResponse {
  success: boolean;
  error?: string;
  documents?: Array<{
    id: string | number;
    original_name: string;
    file_name: string;
    file_size: number;
    status: string;
    created_at: string;
  }>;
}

interface ProcessResponse {
  success: boolean;
  error?: string;
  results?: Array<{
    documentId: string | number;
  }>;
}

export default function DocumentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
  const [showUploadArea, setShowUploadArea] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: NotificationType;
    title: string;
    message: string;
    viewDocumentId?: string | number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    'PDF',
    'JPG', 'JPEG', 'PNG', 'BMP', 'TIFF', 'GIF', 'WEBP'
  ];

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleFileSelect = (files: File[] | FileList) => {
    const newFiles = Array.from(files);

    // Validate file types - only allow PDF and images
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/gif',
      'image/webp'
    ];

    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    newFiles.forEach(file => {
      if (allowedMimeTypes.includes(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`The following files are not supported: ${invalidFiles.join(', ')}. Only PDF and image files (JPG, PNG, BMP, TIFF, GIF, WEBP) are allowed.`);
    }

    if (validFiles.length > 0) {
      const filesWithId: FileData[] = validFiles.map(file => ({
        id: Date.now() + Math.random(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date()
      }));

      setUploadedFiles(prev => [...prev, ...filesWithId]);
      setShowUploadArea(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleChooseFile = () => {
    uploadFileInputRef.current?.click();
  };

  const handleDeleteFile = (fileId: number) => {
    setUploadedFiles(prev => {
      const newFiles = prev.filter(file => file.id !== fileId);
      if (newFiles.length === 0) {
        setShowUploadArea(true);
      }
      return newFiles;
    });
  };

  const handleAddMoreFiles = () => {
    fileInputRef.current?.click();
  };

  const handleStartExtraction = async () => {
    if (uploadedFiles.length === 0) {
      setNotification({
        type: 'warning',
        title: 'No Files Selected',
        message: 'Please upload files first before starting extraction.'
      });
      return;
    }

    try {
      console.log('Starting document processing...');

      // Step 1: Upload files
      const formData = new FormData();
      uploadedFiles.forEach((fileData) => {
        formData.append('files', fileData.file);
      });

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || errorData.message || 'Upload failed');
      }

      const uploadResult: UploadResponse = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      if (!uploadResult.documents || uploadResult.documents.length === 0) {
        throw new Error('No documents were successfully uploaded. Please check the files and try again.');
      }

      // Step 2: Start OCR for each document (sends to Dify chatflow)
      for (const doc of uploadResult.documents) {
        try {
          const startOcrResponse = await fetch('/api/documents/start-ocr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              documentId: doc.id
            })
          });

          const startOcrResult = await startOcrResponse.json();

          if (!startOcrResult.success) {
            console.error(`Failed to start OCR for document ${doc.id}:`, startOcrResult.error);
          }
        } catch (error) {
          console.error(`Error starting OCR for document ${doc.id}:`, error);
        }
      }

      // Show popup message
      setNotification({
        type: 'success',
        title: 'Extraction Started!',
        message: `Your document${uploadResult.documents.length > 1 ? 's are' : ' is'} extracting. You will receive a notification when the extraction is complete.`
        // Don't set viewDocumentId - extraction takes time, document won't be ready immediately
      });

      setUploadedFiles([]);
      setShowUploadArea(true);

    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setNotification({
        type: 'error',
        title: 'Extraction Failed',
        message: errorMessage
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string): string => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️';
    return '📁';
  };

  return (
    <Layout user={user} loading={loading} loadingText="Loading">
      <div className={styles.documentsContainer}>
        <div className={styles.titleSection}>
          <h1 className={styles.mainTitle}>Image Extraction</h1>
          <p className={styles.mainDescription}>
            Extract data from your document with incredible accuracy.
          </p>
        </div>

        {showUploadArea && (
          <div className={styles.fileSection}>
            <div
            data-tg-tour="📄 Document Management - This is your document library. Once you scan or upload documents, they will appear here for easy access and management."
              className={`${styles.uploadArea} ${dragOver ? styles.dragOver : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleChooseFile}
            >
              <div className={styles.uploadIconContainer}>
                <svg 
                  className={styles.uploadIcon}
                  xmlns="http://www.w3.org/2000/svg" 
                  width="48" 
                  height="48" 
                  color="black"
                  fill="black" 
                  viewBox="0 0 16 16"
                >
                  <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"/>
                  <path d="M4.5 12.5A.5.5 0 0 1 5 12h3a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m0-2A.5.5 0 0 1 5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m1.639-3.708 1.33.886 1.854-1.855a.25.25 0 0 1 .289-.047l1.888.974V8.5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V8s1.54-1.274 1.639-1.208M6.25 6a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5"/>
                </svg>
              </div>
              <div className={styles.uploadText}>
                Drag and Drop Files Here
              </div>

              <button
                className={styles.chooseFileButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChooseFile();
                }}
              >
                Choose Files
              </button>
              <input
                ref={uploadFileInputRef}
                type="file"
                multiple
                className={styles.hiddenFileInput}
                onChange={handleFileInputChange}
                accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.gif,.webp,image/*,application/pdf"
              />
            </div>

            <div className={styles.supportedFormats}>
              <div className={styles.supportedFormatsText}>
                Supported formats: {supportedFormats.join(', ')}
              </div>
            </div>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className={styles.uploadedFilesSection}>
            <h2 className={styles.uploadedFilesTitle}>Uploaded Files</h2>
            <div className={styles.filesGrid}>
              {uploadedFiles.map((fileData) => (
                <div key={fileData.id} className={styles.fileCard}>
                  <div className={styles.fileIconContainer}>
                  <svg 
                    className={styles.fileIconSvg}
                    xmlns="http://www.w3.org/2000/svg" 
                    width="48" 
                    height="48" 
                    color="black"
                    fill="black" 
                    viewBox="0 0 16 16"
                  >
                    <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"/>
                    <path d="M4.5 12.5A.5.5 0 0 1 5 12h3a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m0-2A.5.5 0 0 1 5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5m1.639-3.708 1.33.886 1.854-1.855a.25.25 0 0 1 .289-.047l1.888.974V8.5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V8s1.54-1.274 1.639-1.208M6.25 6a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5"/>
                  </svg>
                  </div>
                  <div className={styles.fileName}>
                    {fileData.name}
                  </div>
                  <div className={styles.fileSize}>
                    {formatFileSize(fileData.size)}
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteFile(fileData.id)}
                    title="Delete file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.actionButtons}>
              <button
                className={styles.addFileButton}
                onClick={handleAddMoreFiles}
              >
                +
              </button>
              <button
                className={styles.startExtractionButton}
                onClick={handleStartExtraction}
              >
                Start Extraction
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className={styles.hiddenFileInput}
              onChange={handleFileInputChange}
              accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.gif,.webp,image/*,application/pdf"
            />
          </div>
        )}

        {notification && (
          <NotificationCard
            type={notification.type}
            title={notification.title}
            message={notification.message}
            primaryButtonText={notification.viewDocumentId ? 'View Document' : 'OK'}
            secondaryButtonText={notification.viewDocumentId ? 'Close' : undefined}
            onPrimaryClick={() => {
              if (notification.viewDocumentId) {
                window.open(`/documents/view/${notification.viewDocumentId}`, '_blank');
              }
              setNotification(null);
            }}
            onSecondaryClick={() => setNotification(null)}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </Layout>
  );
}

