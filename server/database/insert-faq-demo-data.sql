-- Insert FAQ demo data for live demo
-- Based on support.tsx FAQ content

INSERT INTO faqs (title, description, status, created_at, updated_at) VALUES
(
  'How do I upload documents for processing?',
  'To upload documents, navigate to the Documents page and click the "Upload" button. You can drag and drop files or click to browse. Supported formats include PDF, JPG, PNG, and DOCX files up to 10MB in size.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'What file formats are supported?',
  'Scaptract supports various file formats including PDF documents, image files (JPG, PNG, GIF), and Microsoft Word documents (DOC, DOCX). For best results with OCR processing, we recommend using high-resolution PDF or image files.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'How long does document processing take?',
  'Document processing time varies based on file size and complexity. Most documents are processed within 2-5 minutes. Large files or documents with complex layouts may take up to 10 minutes. You will receive a notification when processing is complete.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'Can I edit the extracted text?',
  'Yes! After document processing is complete, you can view and edit the extracted text in the document viewer. Click on any text section to make corrections. Your changes are automatically saved.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'How do I download processed documents?',
  'Once processing is complete, you can download your documents in various formats from the Documents page. Click the download icon next to any processed document and choose your preferred format (PDF, TXT, or DOCX).',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'What should I do if OCR results are inaccurate?',
  'If OCR results are not accurate, try uploading a higher quality image or PDF. Ensure the document has good contrast and is not blurry. You can also manually edit the extracted text or contact support for assistance with complex documents.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'Is my data secure?',
  'Yes, we take data security seriously. All uploaded documents are encrypted in transit and at rest. We use industry-standard security measures and comply with data protection regulations. Your documents are only accessible to you and are automatically deleted after 30 days unless you choose to keep them longer.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'How do I reset my password?',
  'To reset your password, click "Forgot Password" on the login page. Enter your email address and you will receive a verification code. Enter the code and create your new password. In development mode, any 6-digit number works as the verification code.',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Verify the insertions
SELECT id, title, status, created_at FROM faqs ORDER BY created_at DESC;
