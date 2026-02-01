import { connectDB } from '../lib/supabase.ts';
import FileType from '../models/supabase/FileType.ts';

interface FileTypeData {
  name: string;
  extension: string;
  mime_type: string;
  max_size_mb: number;
}

const fileTypes: FileTypeData[] = [
  // Document formats
  { name: 'PDF', extension: 'pdf', mime_type: 'application/pdf', max_size_mb: 50 },
  { name: 'DOC', extension: 'doc', mime_type: 'application/msword', max_size_mb: 25 },
  { name: 'DOCX', extension: 'docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', max_size_mb: 25 },
  { name: 'TXT', extension: 'txt', mime_type: 'text/plain', max_size_mb: 10 },
  { name: 'RTF', extension: 'rtf', mime_type: 'application/rtf', max_size_mb: 25 },

  // Image formats
  { name: 'JPG', extension: 'jpg', mime_type: 'image/jpeg', max_size_mb: 20 },
  { name: 'JPEG', extension: 'jpeg', mime_type: 'image/jpeg', max_size_mb: 20 },
  { name: 'PNG', extension: 'png', mime_type: 'image/png', max_size_mb: 20 },
  { name: 'BMP', extension: 'bmp', mime_type: 'image/bmp', max_size_mb: 20 },
  { name: 'TIFF', extension: 'tiff', mime_type: 'image/tiff', max_size_mb: 20 },

  // Spreadsheet formats
  { name: 'XLS', extension: 'xls', mime_type: 'application/vnd.ms-excel', max_size_mb: 25 },
  { name: 'XLSX', extension: 'xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', max_size_mb: 25 },
  { name: 'CSV', extension: 'csv', mime_type: 'text/csv', max_size_mb: 10 },

  // Presentation formats
  { name: 'PPT', extension: 'ppt', mime_type: 'application/vnd.ms-powerpoint', max_size_mb: 25 },
  { name: 'PPTX', extension: 'pptx', mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', max_size_mb: 25 }
];

async function populateFileTypes() {
  try {
    await connectDB();
    console.log('Starting to populate file types...');

    for (const fileTypeData of fileTypes) {
      try {
        // Check if file type already exists
        const existingFileType = await FileType.findByExtension(fileTypeData.extension);

        if (!existingFileType) {
          const fileTypeId = await FileType.create(fileTypeData);
          console.log(`Created file type: ${fileTypeData.name} (ID: ${fileTypeId})`);
        } else {
          console.log(`File type already exists: ${fileTypeData.name}`);
        }
      } catch (error: any) {
        console.error(`Error creating file type ${fileTypeData.name}:`, error);
      }
    }

    console.log('File types population completed!');
    process.exit(0);

  } catch (error: any) {
    console.error('Error populating file types:', error);
    process.exit(1);
  }
}

// Run the script
populateFileTypes();

