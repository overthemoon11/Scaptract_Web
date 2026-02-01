
INSERT INTO file_types (id, name, extension, mime_type, is_supported, max_size_mb)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'PDF Document', 'pdf', 'application/pdf', true, 50),
  ('550e8400-e29b-41d4-a716-446655440002', 'JPEG Image', 'jpg', 'image/jpeg', true, 10),
  ('550e8400-e29b-41d4-a716-446655440003', 'PNG Image', 'png', 'image/png', true, 10),
  ('550e8400-e29b-41d4-a716-446655440004', 'WebP Image', 'webp', 'image/webp', true, 10),
  ('550e8400-e29b-41d4-a716-446655440005', 'BMP Image', 'bmp', 'image/bmp', true, 10),
  ('550e8400-e29b-41d4-a716-446655440006', 'TIFF Image', 'tiff', 'image/tiff', true, 10),
  ('550e8400-e29b-41d4-a716-446655440007', 'GIF Image', 'gif', 'image/gif', true, 10)
ON CONFLICT (id) DO NOTHING;



DO $$
DECLARE
  user_uuid UUID := 'ac3ce741-11da-4c83-94c0-ada7795e79bd';
  pdf_type_id UUID := '550e8400-e29b-41d4-a716-446655440001';
  jpg_type_id UUID := '550e8400-e29b-41d4-a716-446655440002';
  png_type_id UUID := '550e8400-e29b-41d4-a716-446655440003';
  webp_type_id UUID := '550e8400-e29b-41d4-a716-446655440004';
  bmp_type_id UUID := '550e8400-e29b-41d4-a716-446655440005';
  tiff_type_id UUID := '550e8400-e29b-41d4-a716-446655440006';
  gif_type_id UUID := '550e8400-e29b-41d4-a716-446655440007';
  
  target_date DATE;
  days_back INTEGER;
  upload_count INTEGER;
  file_type_id UUID;
  file_name TEXT;
  original_name TEXT;
  mime_type TEXT;
  file_size BIGINT;
  page_count INTEGER;
  status TEXT;
  hour_offset INTEGER;
  minute_offset INTEGER;
  second_offset INTEGER;
  
  day_of_week INTEGER;
  pdf_ratio NUMERIC;
  jpg_ratio NUMERIC;
  png_ratio NUMERIC;
  webp_ratio NUMERIC;
  bmp_ratio NUMERIC;
  tiff_ratio NUMERIC;
  gif_ratio NUMERIC;
  random_val NUMERIC;
  
  doc_id UUID;
  doc_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  FOR days_back IN 0..89 LOOP
    target_date := CURRENT_DATE - days_back;
    day_of_week := EXTRACT(DOW FROM target_date);
    
    IF day_of_week IN (0, 6) THEN
      upload_count := 2 + floor(random() * 7)::INTEGER;
    ELSIF day_of_week IN (1, 5) THEN
      upload_count := 5 + floor(random() * 11)::INTEGER;
    ELSE
      upload_count := 8 + floor(random() * 13)::INTEGER;
    END IF;

    CASE (days_back % 7)
      WHEN 0 THEN
        pdf_ratio := 0.60;
        jpg_ratio := 0.20;
        png_ratio := 0.08;
        webp_ratio := 0.04;
        bmp_ratio := 0.04;
        tiff_ratio := 0.02;
        gif_ratio := 0.02;
      WHEN 1 THEN
        pdf_ratio := 0.30;
        jpg_ratio := 0.30;
        png_ratio := 0.15;
        webp_ratio := 0.10;
        bmp_ratio := 0.08;
        tiff_ratio := 0.05;
        gif_ratio := 0.02;
      WHEN 2 THEN
        pdf_ratio := 0.50;
        jpg_ratio := 0.20;
        png_ratio := 0.12;
        webp_ratio := 0.08;
        bmp_ratio := 0.05;
        tiff_ratio := 0.03;
        gif_ratio := 0.02;
      WHEN 3 THEN
        pdf_ratio := 0.20;
        jpg_ratio := 0.35;
        png_ratio := 0.20;
        webp_ratio := 0.10;
        bmp_ratio := 0.08;
        tiff_ratio := 0.05;
        gif_ratio := 0.02;
      WHEN 4 THEN
        pdf_ratio := 0.70;
        jpg_ratio := 0.15;
        png_ratio := 0.08;
        webp_ratio := 0.04;
        bmp_ratio := 0.02;
        tiff_ratio := 0.01;
        gif_ratio := 0.00;
      WHEN 5 THEN
        pdf_ratio := 0.40;
        jpg_ratio := 0.20;
        png_ratio := 0.18;
        webp_ratio := 0.08;
        bmp_ratio := 0.10;
        tiff_ratio := 0.03;
        gif_ratio := 0.01;
      ELSE
        pdf_ratio := 0.45;
        jpg_ratio := 0.25;
        png_ratio := 0.12;
        webp_ratio := 0.08;
        bmp_ratio := 0.05;
        tiff_ratio := 0.03;
        gif_ratio := 0.02;
    END CASE;
    
    FOR upload_idx IN 1..upload_count LOOP
      random_val := random();
      IF random_val < pdf_ratio THEN
        file_type_id := pdf_type_id;
        mime_type := 'application/pdf';
        original_name := 'document_' || days_back || '_' || upload_idx || '.pdf';
        file_size := (500000 + floor(random() * 4500000))::BIGINT;
        page_count := 1 + floor(random() * 20)::INTEGER;
      ELSIF random_val < pdf_ratio + jpg_ratio THEN
        file_type_id := jpg_type_id;
        mime_type := 'image/jpeg';
        original_name := 'image_' || days_back || '_' || upload_idx || '.jpg';
        file_size := (100000 + floor(random() * 900000))::BIGINT;
        page_count := 1;
      ELSIF random_val < pdf_ratio + jpg_ratio + png_ratio THEN
        file_type_id := png_type_id;
        mime_type := 'image/png';
        original_name := 'image_' || days_back || '_' || upload_idx || '.png';
        file_size := (150000 + floor(random() * 850000))::BIGINT;
        page_count := 1;
      ELSIF random_val < pdf_ratio + jpg_ratio + png_ratio + webp_ratio THEN
        file_type_id := webp_type_id;
        mime_type := 'image/webp';
        original_name := 'image_' || days_back || '_' || upload_idx || '.webp';
        file_size := (80000 + floor(random() * 920000))::BIGINT;
        page_count := 1;
      ELSIF random_val < pdf_ratio + jpg_ratio + png_ratio + webp_ratio + bmp_ratio THEN
        file_type_id := bmp_type_id;
        mime_type := 'image/bmp';
        original_name := 'image_' || days_back || '_' || upload_idx || '.bmp';
        file_size := (200000 + floor(random() * 800000))::BIGINT;
        page_count := 1;
      ELSIF random_val < pdf_ratio + jpg_ratio + png_ratio + webp_ratio + bmp_ratio + tiff_ratio THEN
        file_type_id := tiff_type_id;
        mime_type := 'image/tiff';
        original_name := 'image_' || days_back || '_' || upload_idx || '.tiff';
        file_size := (300000 + floor(random() * 700000))::BIGINT;
        page_count := 1;
      ELSE
        file_type_id := gif_type_id;
        mime_type := 'image/gif';
        original_name := 'image_' || days_back || '_' || upload_idx || '.gif';
        file_size := (50000 + floor(random() * 950000))::BIGINT;
        page_count := 1;
      END IF;
      
        file_name := 'uploads/' || user_uuid || '/' || extract(epoch from target_date)::BIGINT || '_' || upload_idx || '_' || substr(md5(random()::text), 1, 8);
      
      random_val := random();
      IF random_val < 0.85 THEN
        status := 'completed';
      ELSIF random_val < 0.95 THEN
        status := 'processing';
      ELSIF random_val < 0.98 THEN
        status := 'uploaded';
      ELSE
        status := 'failed';
      END IF;
      
      hour_offset := floor(random() * 24)::INTEGER;
      minute_offset := floor(random() * 60)::INTEGER;
      second_offset := floor(random() * 60)::INTEGER;
      
        doc_created_at := target_date + (hour_offset || ' hours')::INTERVAL + (minute_offset || ' minutes')::INTERVAL + (second_offset || ' seconds')::INTERVAL;
      
      INSERT INTO documents (
        id,
        user_id,
        file_type_id,
        file_name,
        original_name,
        file_path,
        file_size,
        mime_type,
        page_count,
        status,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        user_uuid,
        file_type_id,
        file_name,
        original_name,
        file_name,
        file_size,
        mime_type,
        page_count,
        status,
        doc_created_at,
        doc_created_at
      ) RETURNING id INTO doc_id;
      
      IF status = 'completed' THEN
        INSERT INTO extraction_results (
          id,
          document_id,
          extracted_text,
          structured_data,
          accuracy,
          processing_time_ms,
          extraction_method,
          status,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          doc_id,
          'Sample extracted text for document ' || original_name,
          ('{"pages": ' || page_count || ', "confidence": ' || (85 + floor(random() * 15))::INTEGER || '}')::jsonb,
          (85.0 + random() * 15.0)::DECIMAL(5,2),
          (500 + floor(random() * 4500))::INTEGER,
          CASE WHEN mime_type = 'application/pdf' THEN 'pdf_extraction' ELSE 'ocr' END,
          'completed',
          doc_created_at + (30 || ' seconds')::INTERVAL,
          doc_created_at + (30 || ' seconds')::INTERVAL
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

SELECT 
  DATE(created_at) as upload_date,
  COUNT(*) as total_uploads,
  COUNT(CASE WHEN mime_type = 'application/pdf' THEN 1 END) as pdf_count,
  COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) as image_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM documents
WHERE user_id = 'ac3ce741-11da-4c83-94c0-ada7795e79bd'
  AND created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY upload_date DESC
LIMIT 10;

SELECT 
  CASE 
    WHEN mime_type = 'application/pdf' THEN 'PDF'
    WHEN mime_type = 'image/jpeg' THEN 'JPEG'
    WHEN mime_type = 'image/png' THEN 'PNG'
    WHEN mime_type = 'image/webp' THEN 'WEBP'
    WHEN mime_type = 'image/bmp' THEN 'BMP'
    WHEN mime_type = 'image/tiff' THEN 'TIFF'
    WHEN mime_type = 'image/gif' THEN 'GIF'
    ELSE 'OTHER'
  END as file_type,
  COUNT(*) as count
FROM documents
WHERE user_id = 'ac3ce741-11da-4c83-94c0-ada7795e79bd'
  AND DATE(created_at) = CURRENT_DATE - 1
GROUP BY 
  CASE 
    WHEN mime_type = 'application/pdf' THEN 'PDF'
    WHEN mime_type = 'image/jpeg' THEN 'JPEG'
    WHEN mime_type = 'image/png' THEN 'PNG'
    WHEN mime_type = 'image/webp' THEN 'WEBP'
    WHEN mime_type = 'image/bmp' THEN 'BMP'
    WHEN mime_type = 'image/tiff' THEN 'TIFF'
    WHEN mime_type = 'image/gif' THEN 'GIF'
    ELSE 'OTHER'
  END
ORDER BY count DESC;

