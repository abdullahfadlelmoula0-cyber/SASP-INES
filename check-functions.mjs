import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzkuhyccdccjtimzmwqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3VoeWNjZGNjanRpbXptd3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNTU2MSwiZXhwIjoyMTAwNzgxNTYxfQ.xP0Y02JZu-RqkId8sanHtrOoeOgBF027U3ooBNwpvZA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('=== Checking existing helper functions ===\n');
  
  // Check for is_admin function
  const { data: adminTest, error: adminErr } = await supabase.rpc('is_admin');
  console.log('is_admin() function:', adminErr ? 'MISSING' : 'EXISTS');
  
  // Check for matches_academic_profile function
  try {
    const { error: matchErr } = await supabase.rpc('matches_academic_profile', {
      p_user_dept: 'test',
      p_user_prog: 'test', 
      p_user_year: 1,
      p_user_ay: '2026/2027',
      p_target_dept: 'test',
      p_target_prog: 'test',
      p_target_year: 1,
      p_target_ay: '2026/2027'
    });
    console.log('matches_academic_profile() function:', matchErr ? `MISSING (${matchErr.message})` : 'EXISTS');
  } catch (e) {
    console.log('matches_academic_profile() function: MISSING');
  }
  
  // Check actual announcements table structure
  console.log('\n=== Checking announcements table structure ===\n');
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .limit(1);
  
  if (announcements && announcements.length > 0) {
    console.log('Sample announcement fields:', Object.keys(announcements[0]));
  }
  
  // Check for existing policies
  console.log('\n=== Checking existing policies on announcements ===\n');
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('schemaname', 'public')
    .eq('tablename', 'announcements');
    
  if (policies) {
    console.log('Existing policies:');
    policies.forEach(p => console.log(`  - ${p.policyname} (${p.cmd})`));
  }
}

runMigration().then(() => {
  console.log('\n=== Check Complete ===');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
