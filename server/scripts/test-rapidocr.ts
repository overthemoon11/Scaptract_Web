import { RapidOCR } from 'rapidocr';
import path from 'path';

async function testRapidOCR() {
  try {
    console.log('🚀 Initializing RapidOCR engine...');
    const engine = new RapidOCR();

    // Use the local image file
    const imagePath = path.join(
      process.cwd(),
      'uploads',
      'documents',
      'files-1765922002262-857008139.jpg'
    );

    console.log(`📸 Processing image: ${imagePath}`);

    // Check if file exists
    const fs = await import('fs');
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image file not found: ${imagePath}`);
      return;
    }

    // Run OCR
    console.log('⏳ Running OCR...');
    const result = await engine(imagePath);

    console.log('\n✅ OCR Result:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    // Extract text from result
    if (result && Array.isArray(result)) {
      const extractedText = result
        .map((item: any) => {
          if (Array.isArray(item) && item.length > 1) {
            return item[1]; // Text is usually at index 1
          }
          return item;
        })
        .filter((item: any) => typeof item === 'string')
        .join('\n');

      console.log('\n📝 Extracted Text:');
      console.log('-'.repeat(80));
      console.log(extractedText);
      console.log('-'.repeat(80));
      console.log(`\nTotal characters: ${extractedText.length}`);
    }

    // Save visualization
    const outputPath = path.join(process.cwd(), 'uploads', 'documents', 'rapidocr-vis-result.jpg');
    console.log(`\n💾 Saving visualization to: ${outputPath}`);
    await engine.vis(imagePath, outputPath);
    console.log('✅ Visualization saved!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testRapidOCR();

