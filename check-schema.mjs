import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzkuhyccdccjtimzmwqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3VoeWNjZGNjanRpbXptd3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNTU2MSwiZXhwIjoyMTAwNzgxNTYxfQ.xP0Y02JZu-RqkId8sanHtrOoeOgBF027U3ooBNwpvZA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('=== Checking Announcements Table Schema ===\n');
  
  // Check announcements table columns
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', { 
      query: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_schema='public' AND table_name='announcements' 
              ORDER BY ordinal_position;`
    });
  
  if (colError) {
    console.log('Using direct query instead...');
    // Try direct query
    const { data: tableData, error: tableError } = await supabase
      .from('announcements')
      .select('*')
      .limit(0);
    
    if (tableError) {
      console.error('Error:', tableError);
    } else {
      console.log('Announcements table exists!');
    }
  } else {
    console.log('Announcements columns:', columns);
  }
  
  // Check if announcement_attachments table exists
  console.log('\n=== Checking Announcement Attachments Table ===\n');
  const { data: attachData, error: attachError } = await supabase
    .from('announcement_attachments')
    .select('*')
    .limit(0);
  
  if (attachError) {
    console.log('announcement_attachments table does NOT exist yet');
    console.log('Error:', attachError.message);
  } else {
    console.log('announcement_attachments table EXISTS');
  }
  
  // Check storage buckets
  console.log('\n=== Checking Storage Buckets ===\n');
  const { data: buckets, error: bucketError } = await supabase
    .storage
    .listBuckets();
  
  if (bucketError) {
    console.error('Error fetching buckets:', bucketError);
  } else {
    console.log('Available buckets:', buckets.map(b => b.name));
    
    const hasCovers = buckets.some(b => b.name === 'announcement-covers');
    const hasAttachments = buckets.some(b => b.name === 'announcement-attachments');
    
    console.log('\nannouncement-covers:', hasCovers ? 'EXISTS' : 'MISSING');
    console.log('announcement-attachments:', hasAttachments ? 'EXISTS' : 'MISSING');
  }
  
  // Check for helper functions
  console.log('\n=== Checking Helper Functions ===\n');
  const { data: funcs, error: funcError } = await supabase
    .rpc('exec_sql', {
      query: `SELECT routine_name FROM information_schema.routines 
              WHERE routine_schema='public' AND routine_name IN 
              ('announcement_visible_to_user', 'can_manage_announcement', 'is_admin');`
    });
  
  if (!funcError && funcs) {
    console.log('Functions found:', funcs);
  }
  
  // Sample announcements
  console.log('\n=== Sample Announcements Data ===\n');
  const { data: announcements, error: annError } = await supabase
    .from('announcements')
    .select('id, title, cover_image_url, created_at')
    .limit(3);
  
  if (annError) {
    console.error('Error fetching announcements:', annError);
  } else {
    console.log(`Found ${announcements?.length || 0} announcements`);
    if (announcements && announcements.length > 0) {
      announcements.forEach(a => {
        console.log(`- ${a.title} (cover: ${a.cover_image_url ? 'YES' : 'NO'})`);
      });
    }
  }
}

checkSchema().then(() => {
  console.log('\n=== Schema Check Complete ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
