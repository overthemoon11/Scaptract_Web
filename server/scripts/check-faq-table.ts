import { getConnection } from '../lib/supabase.ts';

async function checkFAQTable() {
  try {
    console.log('Checking FAQs table...');
    const supabase = getConnection();
    
    // Try to query the table structure
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.error('❌ ERROR: FAQs table does not exist!');
        console.log('\nPlease run this SQL in your Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
        `);
        process.exit(1);
      } else {
        console.error('❌ ERROR:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        process.exit(1);
      }
    } else {
      console.log('✅ FAQs table exists and is accessible!');
      console.log('Current FAQs count:', data?.length || 0);
    }
    
    // Test insert
    console.log('\nTesting FAQ creation...');
    const testData = {
      title: 'Test FAQ',
      description: 'This is a test FAQ to verify the table works',
      status: 'active'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('faqs')
      .insert(testData)
      .select('id')
      .single();
    
    if (insertError) {
      console.error('❌ ERROR inserting test FAQ:', insertError.message);
      console.error('Error code:', insertError.code);
      console.error('Error details:', insertError.details);
      process.exit(1);
    } else {
      console.log('✅ Test FAQ created successfully!');
      console.log('Test FAQ ID:', insertData?.id);
      
      // Clean up test FAQ
      if (insertData?.id) {
        await supabase
          .from('faqs')
          .delete()
          .eq('id', insertData.id);
        console.log('✅ Test FAQ cleaned up');
      }
    }
    
    console.log('\n✅ All checks passed! Your FAQs table is properly configured.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

checkFAQTable();
