import { connectDB } from '../lib/supabase.ts';
import User from '../models/supabase/User.ts';

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');

    // Test database connection
    await connectDB();
    console.log('✅ Supabase connection successful!');

    // Test User model
    console.log('🔄 Testing User model...');
    const users = await User.findAll();
    console.log(`✅ User model working! Found ${users.length} users.`);

    console.log('🎉 All tests passed! Supabase is ready.');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Please check your Supabase configuration and ensure the database is accessible.');
  }
}

testConnection();

