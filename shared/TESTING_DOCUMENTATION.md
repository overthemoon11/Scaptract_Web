# System Testing Documentation for Scaptract

## Table of Contents
1. [Unit Testing](#unit-testing)
2. [Integration Testing](#integration-testing)
3. [System Testing](#system-testing)

---

# Unit Testing

## Test Suite: TS-UT-01 Authentication Module - Login

| Test Suite | TS-UT-01 Authentication Module - Login |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR1.1.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-01-01 | Login with Valid Credentials | 1 | Email: user@example.com<br>Password: password123 | Login successfully and redirect to Dashboard. | | |
| TC-UT-01-02 | Login with Invalid Email | 1 | Email: invalid-email<br>Password: password123 | Display error message "Invalid email format". | | |
| TC-UT-01-03 | Login with Empty Email | 1 | Email: -<br>Password: password123 | Display error message "Please fill out this field" at Email input. | | |
| TC-UT-01-04 | Login with Empty Password | 1 | Email: user@example.com<br>Password: - | Display error message "Please fill out this field" at Password input. | | |
| TC-UT-01-05 | Login with Non-existent User | 1 | Email: nonexistent@example.com<br>Password: password123 | Display error message "User does not exist". | | |
| TC-UT-01-06 | Login with Incorrect Password | 1 | Email: user@example.com<br>Password: wrongpassword | Display error message "Invalid email or password". | | |

---

## Test Suite: TS-UT-02 Authentication Module - Registration

| Test Suite | TS-UT-02 Authentication Module - Registration |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR1.1.2 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-02-01 | Register with Valid Data | 1 | Email: newuser@example.com<br>Password: password123<br>Confirm Password: password123<br>Full Name: John Doe | Account created, OTP sent to email. | | |
| TC-UT-02-02 | Register with Invalid Email Format | 1 | Email: invalid-email<br>Password: password123<br>Confirm Password: password123 | Display error message "Please include an '@' in the email address". | | |
| TC-UT-02-03 | Register with Empty Email | 1 | Email: -<br>Password: password123<br>Confirm Password: password123 | Display error message "Please fill out this field" at Email input. | | |
| TC-UT-02-04 | Register with Short Password | 1 | Email: user@example.com<br>Password: 123<br>Confirm Password: 123 | Display error message "Password must be at least 8 characters". | | |
| TC-UT-02-05 | Register with Mismatched Passwords | 1 | Email: user@example.com<br>Password: password123<br>Confirm Password: password456 | Display error message "Passwords do not match". | | |
| TC-UT-02-06 | Register with Existing Email | 1 | Email: existing@example.com<br>Password: password123<br>Confirm Password: password123 | Display error message "Email already registered". | | |
| TC-UT-02-07 | Verify OTP with Correct Code | 1 | Email: newuser@example.com<br>OTP: [6-digit code from email] | Account activated, redirect to login. | | |
| TC-UT-02-08 | Verify OTP with Incorrect Code | 1 | Email: newuser@example.com<br>OTP: 000000 | Display error message "Invalid OTP code". | | |
| TC-UT-02-09 | Verify OTP with Expired Code | 1 | Email: newuser@example.com<br>OTP: [code after 10 minutes] | Display error message "OTP has expired". | | |

---

## Test Suite: TS-UT-03 Document Upload Module

| Test Suite | TS-UT-03 Document Upload Module |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.1.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-03-01 | Upload Single PDF File | 1 | File: document.pdf (2MB)<br>File Type: application/pdf | File uploaded successfully, document record created in database. | | |
| TC-UT-03-02 | Upload Single Image File (JPG) | 1 | File: image.jpg (1MB)<br>File Type: image/jpeg | File uploaded successfully, document record created. | | |
| TC-UT-03-03 | Upload Single Image File (PNG) | 1 | File: image.png (1.5MB)<br>File Type: image/png | File uploaded successfully, document record created. | | |
| TC-UT-03-04 | Upload Multiple Files | 1 | Files: doc1.pdf, doc2.pdf, image1.jpg<br>Total Size: 5MB | All files uploaded successfully, multiple document records created. | | |
| TC-UT-03-05 | Upload File Exceeding Size Limit | 1 | File: large.pdf (25MB)<br>Max Size: 20MB | Display error message "File size exceeds maximum limit of 20MB". | | |
| TC-UT-03-06 | Upload Unsupported File Type | 1 | File: document.exe<br>File Type: application/x-msdownload | Display error message "Unsupported file type. Please upload PDF or image files". | | |
| TC-UT-03-07 | Upload Without Authentication | 1 | No authentication token<br>File: document.pdf | Display error message "Unauthorized access" (401 status). | | |
| TC-UT-03-08 | Upload Empty File | 1 | File: empty.pdf (0 bytes) | Display error message "File cannot be empty". | | |

---

## Test Suite: TS-UT-04 OCR Processing Module

| Test Suite | TS-UT-04 OCR Processing Module |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.2.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-04-01 | Process Single Image (JPG) | 1 | File: image.jpg<br>Endpoint: /imgOcr/async | OCR job submitted, returns job_id and status "pending". | | |
| TC-UT-04-02 | Process Multiple Images | 1 | Files: image1.jpg, image2.jpg, image3.jpg<br>Endpoint: /imgOcr/async | OCR job submitted for 3 files, returns job_id and num_files: 3. | | |
| TC-UT-04-03 | Process PDF File | 1 | File: document.pdf (5 pages)<br>Endpoint: /imgOcr/async | PDF converted to images, OCR job submitted for 5 pages. | | |
| TC-UT-04-04 | OCR with Valid Callback URL | 1 | File: image.jpg<br>Callback URL: http://192.168.0.24/triggers/webhook/xxx | OCR processes, sends callback to webhook URL with extracted text. | | |
| TC-UT-04-05 | OCR with Invalid Callback URL | 1 | File: image.jpg<br>Callback URL: http://invalid-url | OCR processes, callback fails, error logged. | | |
| TC-UT-04-06 | OCR with Corrupted Image | 1 | File: corrupted.jpg | OCR fails, returns error status, error message in callback. | | |
| TC-UT-04-07 | OCR with Low Quality Image | 1 | File: low-quality.jpg (blurry) | OCR processes but accuracy may be reduced, text extracted. | | |
| TC-UT-04-08 | Check OCR Job Status | 1 | Job ID: [valid job_id]<br>Endpoint: /imgOcr/status/{job_id} | Returns job status (pending/processing/completed/failed). | | |

---

## Test Suite: TS-UT-05 Document Extraction Module

| Test Suite | TS-UT-05 Document Extraction Module |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.3.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-05-01 | Start Extraction for Single Page Document | 1 | Document ID: [valid_id]<br>Endpoint: /api/documents/start-extraction | Extraction started, returns extraction_result_id, status "processing". | | |
| TC-UT-05-02 | Start Extraction for Multi-Page PDF | 1 | Document ID: [valid_id]<br>Pages: 10 | Extraction started, Workflow 1 triggered, all pages processed. | | |
| TC-UT-05-03 | Start Extraction with Invalid Document ID | 1 | Document ID: invalid-id | Display error message "Document not found" (404 status). | | |
| TC-UT-05-04 | Start Extraction for Another User's Document | 1 | Document ID: [other_user_document_id] | Display error message "Unauthorized access" (403 status). | | |
| TC-UT-05-05 | Get Extraction Result | 1 | Extraction Result ID: [valid_id]<br>Endpoint: /api/documents/extract/{id} | Returns extracted_text, structured_data, status, accuracy. | | |
| TC-UT-05-06 | Get Extraction Result Status | 1 | Extraction Result ID: [valid_id] | Returns status: processing/completed/failed. | | |

---

## Test Suite: TS-UT-06 Notification Module

| Test Suite | TS-UT-06 Notification Module |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR3.1.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-06-01 | Create Notification | 1 | User ID: [valid_id]<br>Title: "Extraction Complete"<br>Message: "Your document has been processed" | Notification created in database, is_read: false. | | |
| TC-UT-06-02 | Get All Notifications | 1 | User ID: [valid_id]<br>Endpoint: /api/notifications | Returns list of all notifications for user. | | |
| TC-UT-06-03 | Mark Notification as Read | 1 | Notification ID: [valid_id]<br>Endpoint: /api/notifications/{id} | Notification is_read updated to true. | | |
| TC-UT-06-04 | Mark All Notifications as Read | 1 | User ID: [valid_id]<br>Endpoint: /api/notifications/mark-all | All user notifications marked as read. | | |
| TC-UT-06-05 | Delete Notification | 1 | Notification ID: [valid_id] | Notification deleted from database. | | |
| TC-UT-06-06 | Get Unread Notification Count | 1 | User ID: [valid_id] | Returns count of unread notifications. | | |

---

## Test Suite: TS-UT-07 Profile Management Module

| Test Suite | TS-UT-07 Profile Management Module |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR4.1.1 |
| Test Case ID | Condition / Feature to be tested | Data Set | | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- | --- |
| | | No. | Data | | | |
| TC-UT-07-01 | Get User Profile | 1 | User ID: [valid_id]<br>Endpoint: /api/profile | Returns user profile (name, email, avatar, etc.). | | |
| TC-UT-07-02 | Update Profile Name | 1 | User ID: [valid_id]<br>New Name: "John Doe" | Profile name updated in database. | | |
| TC-UT-07-03 | Update Profile Email | 1 | User ID: [valid_id]<br>New Email: "newemail@example.com" | Email updated, verification email sent. | | |
| TC-UT-07-04 | Upload Profile Image | 1 | User ID: [valid_id]<br>File: avatar.jpg<br>Endpoint: /api/profile/upload-image | Profile image uploaded, URL updated in database. | | |
| TC-UT-07-05 | Change Password | 1 | User ID: [valid_id]<br>Current Password: oldpass<br>New Password: newpass123 | Password updated in database. | | |
| TC-UT-07-06 | Change Password with Wrong Current Password | 1 | User ID: [valid_id]<br>Current Password: wrongpass<br>New Password: newpass123 | Display error message "Current password is incorrect". | | |

---

# Integration Testing

## Test Suite: TS-IT-01 Document Upload and OCR Integration

| Test Suite | TS-IT-01 Document Upload and OCR Integration |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.1.1, FR2.2.1 |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-IT-01-01 | Upload Document and Trigger OCR | 1. Login as user<br>2. Upload PDF file<br>3. Click "Start Extraction"<br>4. Wait for OCR processing | Document uploaded, OCR job created, extraction_result created, status updates to "processing" then "completed". | | |
| TC-IT-01-02 | Multi-Page PDF Processing Flow | 1. Upload 10-page PDF<br>2. Start extraction<br>3. Monitor workflow progress | All 10 pages converted to images, OCR processes all pages, combined text sent to Workflow 2, structured data extracted. | | |
| TC-IT-01-03 | Image Upload and Direct OCR | 1. Upload JPG image<br>2. Start extraction | Image sent directly to OCR API, text extracted, sent to Workflow 2 for processing. | | |
| TC-IT-01-04 | Failed OCR and Error Handling | 1. Upload corrupted image<br>2. Start extraction | OCR fails, error logged, extraction_result status set to "failed", user notified. | | |

---

## Test Suite: TS-IT-02 Dify Workflow Integration

| Test Suite | TS-IT-02 Dify Workflow Integration |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.3.1 |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-IT-02-01 | Workflow 1 Trigger from Server | 1. Server calls /api/documents/start-extraction<br>2. Server triggers Dify Workflow 1<br>3. Workflow 1 receives file URL | Workflow 1 triggered successfully, file downloaded from server, processing begins. | | |
| TC-IT-02-02 | Workflow 1 to OCR API Communication | 1. Workflow 1 processes file<br>2. Sends all images to OCR API<br>3. OCR API processes images | OCR API receives all files, processes in parallel, sends combined text to Workflow 2 webhook. | | |
| TC-IT-02-03 | OCR API to Workflow 2 Webhook | 1. OCR API completes processing<br>2. Sends callback to Workflow 2 webhook<br>3. Workflow 2 receives text | Workflow 2 webhook triggered, receives combined text with extraction_result_id, document_id, user_id. | | |
| TC-IT-02-04 | Workflow 2 Processing and Callback | 1. Workflow 2 receives text<br>2. Chunks text, processes with LLM<br>3. Sends results to server callback | Workflow 2 processes text, extracts structured data, sends answer1 and combined_text to server. | | |
| TC-IT-02-05 | Server Receives Workflow 2 Results | 1. Workflow 2 calls /api/ocr-webhook/workflow2-callback<br>2. Server saves structured_data and extracted_text<br>3. Server sends notification | Server receives results, saves to database, updates extraction_result status to "completed", user notified. | | |

---

## Test Suite: TS-IT-03 Authentication and Authorization Integration

| Test Suite | TS-IT-03 Authentication and Authorization Integration |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR1.1.1, FR1.1.2 |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-IT-03-01 | Register, Verify OTP, and Login Flow | 1. Register new user<br>2. Receive OTP email<br>3. Verify OTP<br>4. Login with credentials | User registered, OTP verified, account activated, login successful, JWT token issued. | | |
| TC-IT-03-02 | Protected Route Access with Valid Token | 1. Login successfully<br>2. Access /api/documents/user-documents with JWT token | Documents list returned successfully. | | |
| TC-IT-03-03 | Protected Route Access with Invalid Token | 1. Use expired/invalid JWT token<br>2. Access protected route | Returns 401 Unauthorized error. | | |
| TC-IT-03-04 | User Access to Own Documents Only | 1. User A logs in<br>2. Attempts to access User B's document | Returns 403 Forbidden error. | | |
| TC-IT-03-05 | Session Extension | 1. User logged in<br>2. Call /api/auth/extend-session before token expires | Session extended, new token issued. | | |

---

## Test Suite: TS-IT-04 Notification and Extraction Integration

| Test Suite | TS-IT-04 Notification and Extraction Integration |
| --- | --- |
| Tester | [Your Name] |
| Test Requirement ID | FR2.3.1, FR3.1.1 |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-IT-04-01 | Extraction Complete Notification | 1. Start extraction<br>2. Wait for processing to complete<br>3. Check notifications | Notification created with title "Extraction Complete", message includes document name, is_read: false. | | |
| TC-IT-04-02 | Extraction Failed Notification | 1. Start extraction with corrupted file<br>2. Wait for failure<br>3. Check notifications | Notification created with title "Extraction Failed", error message included. | | |
| TC-IT-04-03 | Multiple Extractions and Notifications | 1. Start 3 extractions simultaneously<br>2. Wait for all to complete | 3 separate notifications created, one for each extraction. | | |

---

# System Testing

## Test Suite: TS-ST-01 End-to-End Document Extraction Flow

| Test Suite | TS-ST-01 End-to-End Document Extraction Flow |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-01-01 | Complete Single Page Document Extraction | 1. Login as user<br>2. Navigate to Documents page<br>3. Upload single-page PDF<br>4. Click "Start Extraction"<br>5. Wait for completion<br>6. View extraction results | Document uploaded, extraction started, OCR processes, Workflow 2 extracts structured data, results saved, notification received, results displayed correctly. | | |
| TC-ST-01-02 | Complete Multi-Page PDF Extraction | 1. Login as user<br>2. Upload 15-page PDF<br>3. Start extraction<br>4. Monitor progress<br>5. View results | All 15 pages processed, combined text extracted, structured data extracted, results displayed with page separators. | | |
| TC-ST-01-03 | Complete Image Extraction | 1. Login as user<br>2. Upload JPG image<br>3. Start extraction<br>4. View results | Image processed, text extracted, structured data extracted, results displayed. | | |
| TC-ST-01-04 | Multiple Documents Extraction | 1. Login as user<br>2. Upload 5 documents<br>3. Start extraction for all<br>4. Wait for all to complete | All 5 documents processed independently, separate extraction results, separate notifications. | | |

---

## Test Suite: TS-ST-02 User Authentication and Session Management

| Test Suite | TS-ST-02 User Authentication and Session Management |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-02-01 | Complete Registration Flow | 1. Navigate to Register page<br>2. Fill registration form<br>3. Submit<br>4. Check email for OTP<br>5. Enter OTP<br>6. Verify account | Registration successful, OTP email received, account verified, redirect to login page. | | |
| TC-ST-02-02 | Complete Login and Dashboard Access | 1. Navigate to Login page<br>2. Enter credentials<br>3. Click Login<br>4. Access Dashboard | Login successful, JWT token stored, redirect to Dashboard, user data loaded. | | |
| TC-ST-02-03 | Session Timeout and Re-login | 1. Login successfully<br>2. Wait for token to expire (or manually expire)<br>3. Attempt to access protected route<br>4. Re-login | Session expires, protected routes return 401, user redirected to login, re-login successful. | | |
| TC-ST-02-04 | Password Reset Flow | 1. Click "Forgot Password"<br>2. Enter email<br>3. Check email for reset link<br>4. Click reset link<br>5. Enter new password<br>6. Login with new password | Reset email sent, reset link works, password updated, login with new password successful. | | |

---

## Test Suite: TS-ST-03 Document Management System

| Test Suite | TS-ST-03 Document Management System |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-03-01 | View Documents List | 1. Login as user<br>2. Navigate to Documents page | List of user's documents displayed with status, upload date, file name. | | |
| TC-ST-03-02 | Filter Documents by Status | 1. Navigate to Documents page<br>2. Filter by "Completed" status | Only completed documents displayed. | | |
| TC-ST-03-03 | Search Documents | 1. Navigate to Documents page<br>2. Enter search term in search box | Documents matching search term displayed. | | |
| TC-ST-03-04 | Download Document | 1. Navigate to Documents page<br>2. Click download icon on a document | Document file downloaded successfully. | | |
| TC-ST-03-05 | View Extraction Results | 1. Navigate to Documents page<br>2. Click on completed document<br>3. View extraction results | Extraction results page displays extracted_text and structured_data correctly. | | |
| TC-ST-03-06 | Delete Document | 1. Navigate to Documents page<br>2. Click delete on a document<br>3. Confirm deletion | Document deleted from database and file system, removed from list. | | |

---

## Test Suite: TS-ST-04 Notification System

| Test Suite | TS-ST-04 Notification System |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-04-01 | View Notifications | 1. Login as user<br>2. Click notification bell icon | Notification dropdown displays all notifications, unread count shown. | | |
| TC-ST-04-02 | Mark Notification as Read | 1. Click on a notification<br>2. View notification details | Notification marked as read, unread count decreases. | | |
| TC-ST-04-03 | Mark All Notifications as Read | 1. Click "Mark All as Read" button | All notifications marked as read, unread count becomes 0. | | |
| TC-ST-04-04 | Real-time Notification on Extraction Complete | 1. Start extraction<br>2. Wait for completion without refreshing page | New notification appears in real-time, unread count increases. | | |

---

## Test Suite: TS-ST-05 Profile Management System

| Test Suite | TS-ST-05 Profile Management System |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-05-01 | View Profile Information | 1. Login as user<br>2. Navigate to Profile page | Profile details displayed (name, email, avatar, registration date). | | |
| TC-ST-05-02 | Update Profile Information | 1. Navigate to Profile page<br>2. Edit name field<br>3. Click "Save Changes" | Profile updated, success message displayed, changes reflected immediately. | | |
| TC-ST-05-03 | Upload Profile Image | 1. Navigate to Profile page<br>2. Click "Change Avatar"<br>3. Select image file<br>4. Upload | Profile image uploaded, new avatar displayed, image URL updated in database. | | |
| TC-ST-05-04 | Change Password | 1. Navigate to Profile page<br>2. Enter current password<br>3. Enter new password<br>4. Confirm new password<br>5. Click "Update Password" | Password updated, success message displayed, can login with new password. | | |

---

## Test Suite: TS-ST-06 OCR API Integration

| Test Suite | TS-ST-06 OCR API Integration |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-06-01 | OCR API Health Check | 1. Call GET /health endpoint | Returns status: "healthy" or "unhealthy", PaddleOCR status included. | | |
| TC-ST-06-02 | Process Multiple Images in Single Request | 1. Send POST /imgOcr/async with multiple files<br>2. Wait for callback | All images processed, combined text sent to callback URL with page separators. | | |
| TC-ST-06-03 | OCR API Error Handling | 1. Send invalid file to OCR API<br>2. Monitor error response | Error returned, error message in callback, job status set to "failed". | | |
| TC-ST-06-04 | OCR API Callback Delivery | 1. Send OCR request with valid callback URL<br>2. Monitor callback delivery | Callback sent to Workflow 2 webhook with correct payload format. | | |

---

## Test Suite: TS-ST-07 Admin Module (if applicable)

| Test Suite | TS-ST-07 Admin Module |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-07-01 | Admin Login | 1. Login with admin credentials | Login successful, redirect to Admin Dashboard. | | |
| TC-ST-07-02 | View All Users | 1. Navigate to Admin > Users | List of all users displayed with status, registration date. | | |
| TC-ST-07-03 | View All Documents | 1. Navigate to Admin > Documents | List of all documents from all users displayed. | | |
| TC-ST-07-04 | View System Analytics | 1. Navigate to Admin > Analytics | Analytics dashboard displays system statistics. | | |
| TC-ST-07-05 | Manage Support Tickets | 1. Navigate to Admin > Support Tickets<br>2. View ticket<br>3. Update status | Support tickets displayed, status can be updated. | | |

---

## Test Suite: TS-ST-08 Error Handling and Edge Cases

| Test Suite | TS-ST-08 Error Handling and Edge Cases |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-08-01 | Network Interruption During Upload | 1. Start uploading large file<br>2. Disconnect network mid-upload | Upload fails gracefully, error message displayed, user can retry. | | |
| TC-ST-08-02 | Server Error During Extraction | 1. Start extraction<br>2. Simulate server error | Error handled, extraction_result status set to "failed", user notified. | | |
| TC-ST-08-03 | Dify Workflow Failure | 1. Start extraction<br>2. Simulate Dify workflow failure | Error logged, extraction_result status set to "failed", user notified with error message. | | |
| TC-ST-08-04 | Concurrent User Operations | 1. Two users upload documents simultaneously<br>2. Both start extractions | Both operations process independently, no conflicts, both users receive notifications. | | |
| TC-ST-08-05 | Large File Processing | 1. Upload 50-page PDF<br>2. Start extraction | All pages processed, extraction completes successfully, results saved. | | |

---

## Test Suite: TS-ST-09 Performance Testing

| Test Suite | TS-ST-09 Performance Testing |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-09-01 | Page Load Performance | 1. Navigate to Documents page<br>2. Measure load time | Page loads within 2 seconds. | | |
| TC-ST-09-02 | Document Upload Performance | 1. Upload 10MB file<br>2. Measure upload time | File uploads within 30 seconds. | | |
| TC-ST-09-03 | OCR Processing Performance | 1. Process 10-page PDF<br>2. Measure processing time | OCR completes within 2 minutes. | | |
| TC-ST-09-04 | Database Query Performance | 1. Load documents list with 1000 documents<br>2. Measure query time | Query executes within 1 second. | | |

---

## Test Suite: TS-ST-10 Security Testing

| Test Suite | TS-ST-10 Security Testing |
| --- | --- |
| Tester | [Your Name] |
| Test Case ID | Condition / Feature to be tested | Test Data / Steps | Expected Result | Actual Result | Test Status (P - Pass, F - Fail) |
| --- | --- | --- | --- | --- | --- |
| TC-ST-10-01 | SQL Injection Prevention | 1. Attempt SQL injection in login form<br>2. Attempt SQL injection in search | SQL injection attempts blocked, error handled safely. | | |
| TC-ST-10-02 | XSS Prevention | 1. Enter script tags in form fields<br>2. Submit form | Script tags sanitized, XSS prevented. | | |
| TC-ST-10-03 | File Upload Security | 1. Attempt to upload executable file<br>2. Attempt to upload file with malicious content | Unsupported file types rejected, malicious content detected. | | |
| TC-ST-10-04 | Authentication Token Security | 1. Attempt to access API with expired token<br>2. Attempt to access API with tampered token | Access denied, 401 Unauthorized returned. | | |
| TC-ST-10-05 | Rate Limiting | 1. Send multiple rapid requests<br>2. Monitor rate limiting | Rate limiting applied, excessive requests blocked. | | |

---

## Summary

### Test Coverage Summary

| Test Level | Total Test Cases | Passed | Failed | Pass Rate |
| --- | --- | --- | --- | --- |
| Unit Testing | 45 | | | |
| Integration Testing | 12 | | | |
| System Testing | 40 | | | |
| **Total** | **97** | | | |

### Test Execution Log

| Date | Test Suite | Test Cases Executed | Passed | Failed | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

---

**Document Version:** 1.0  
**Last Updated:** [Date]  
**Prepared By:** [Your Name]  
**Reviewed By:** [Reviewer Name]
