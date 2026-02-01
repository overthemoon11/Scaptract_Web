import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface TesseractConfig {
  tesseractPath?: string;
  language?: string;
  psm?: number; // Page segmentation mode (0-13)
  oem?: number; // OCR Engine mode (0-3)
}

interface OCRResult {
  success: boolean;
  text: string;
  confidence?: number;
  error?: string;
}

class TesseractService {
  private tesseractPath: string;
  private language: string;
  private psm: number;
  private oem: number;

  constructor(config: TesseractConfig = {}) {
    // Default path for Windows installation
    this.tesseractPath = config.tesseractPath || process.env.TESSERACT_PATH || 'D:/Tesseract/tesseract.exe';
    this.language = config.language || process.env.OCR_LANG || 'eng';
    this.psm = config.psm || 6; // Assume uniform block of text
    this.oem = config.oem || 3; // Default OCR engine mode
  }

  /**
   * Check if Tesseract is available at the configured path
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      // Check if executable exists
      if (!fs.existsSync(this.tesseractPath)) {
        return {
          available: false,
          error: `Tesseract executable not found at: ${this.tesseractPath}`
        };
      }

      // Try to get version
      const { stdout, stderr } = await execAsync(`"${this.tesseractPath}" --version`, {
        timeout: 5000
      });

      if (stderr && !stdout) {
        return {
          available: false,
          error: `Tesseract error: ${stderr}`
        };
      }

      const versionMatch = stdout.match(/tesseract\s+(\d+\.\d+\.\d+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return {
        available: true,
        version: version
      };
    } catch (error: any) {
      return {
        available: false,
        error: `Failed to check Tesseract: ${error.message}`
      };
    }
  }

  /**
   * Extract text from an image file using native Tesseract OCR
   */
  async extractTextFromImage(imagePath: string, options: { language?: string; psm?: number; oem?: number } = {}): Promise<OCRResult> {
    try {
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        return {
          success: false,
          text: '',
          error: `Image file not found: ${imagePath}`
        };
      }

      // Use provided options or defaults
      const lang = options.language || this.language;
      const psm = options.psm !== undefined ? options.psm : this.psm;
      const oem = options.oem !== undefined ? options.oem : this.oem;

      // Create temporary output file
      const tempDir = path.dirname(imagePath);
      const tempOutput = path.join(tempDir, `tesseract_output_${Date.now()}.txt`);

      // Build Tesseract command
      // Format: tesseract <input_image> <output_base> -l <language> --psm <mode> --oem <mode>
      const command = `"${this.tesseractPath}" "${imagePath}" "${tempOutput.replace('.txt', '')}" -l ${lang} --psm ${psm} --oem ${oem}`;

      console.log(`🔍 Running Tesseract OCR: ${command}`);

      // Execute Tesseract
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Tesseract creates output file with .txt extension
      const outputFile = tempOutput.replace('.txt', '') + '.txt';

      // Read the extracted text
      let extractedText = '';
      if (fs.existsSync(outputFile)) {
        extractedText = fs.readFileSync(outputFile, 'utf-8').trim();
        // Clean up temporary file
        fs.unlinkSync(outputFile);
      } else {
        // Sometimes Tesseract outputs to stdout
        if (stdout && stdout.trim()) {
          extractedText = stdout.trim();
        } else {
          throw new Error('Tesseract did not produce output file');
        }
      }

      // Check for errors in stderr (Tesseract outputs warnings to stderr even on success)
      if (stderr && !extractedText) {
        // If there's stderr and no text, it's likely an error
        if (stderr.includes('Error') || stderr.includes('failed')) {
          return {
            success: false,
            text: '',
            error: `Tesseract error: ${stderr}`
          };
        }
      }

      if (!extractedText || extractedText.length === 0) {
        return {
          success: false,
          text: '',
          error: 'No text extracted from image'
        };
      }

      console.log(`✅ Tesseract OCR completed. Extracted ${extractedText.length} characters.`);

      return {
        success: true,
        text: extractedText,
        confidence: this.calculateConfidence(extractedText)
      };

    } catch (error: any) {
      console.error('Tesseract OCR error:', error);
      return {
        success: false,
        text: '',
        error: `OCR extraction failed: ${error.message}`
      };
    }
  }

  /**
   * Extract text from multiple images
   */
  async extractTextFromImages(imagePaths: string[], options: { language?: string; psm?: number; oem?: number } = {}): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (const imagePath of imagePaths) {
      const result = await this.extractTextFromImage(imagePath, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate confidence score based on extracted text characteristics
   */
  private calculateConfidence(text: string): number {
    if (!text || text.length === 0) return 0;

    let confidence = 0.5; // Base confidence

    // Increase confidence for longer text
    if (text.length > 50) confidence += 0.1;
    if (text.length > 200) confidence += 0.1;
    if (text.length > 500) confidence += 0.1;

    // Check for common text patterns
    if (text.includes('\n')) confidence += 0.05; // Multiple lines
    if (text.match(/\d+/)) confidence += 0.05; // Contains numbers
    if (text.match(/[A-Z][a-z]+/)) confidence += 0.05; // Contains capitalized words
    if (text.match(/[.!?]/)) confidence += 0.05; // Contains punctuation

    return Math.min(confidence, 1.0);
  }

  /**
   * Get available languages from Tesseract
   */
  async getAvailableLanguages(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`"${this.tesseractPath}" --list-langs`, {
        timeout: 5000
      });

      // Parse language list (skip first line which is usually "List of available languages")
      const languages = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.toLowerCase().includes('list'))
        .filter(line => line !== 'osd'); // Filter out OSD (orientation and script detection)

      return languages;
    } catch (error: any) {
      console.error('Failed to get available languages:', error);
      return ['eng']; // Default to English
    }
  }
}

export default TesseractService;

