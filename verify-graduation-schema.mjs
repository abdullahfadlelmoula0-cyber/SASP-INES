import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzkuhyccdccjtimzmwqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3VoeWNjZGNjanRpbXptd3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNTU2MSwiZXhwIjoyMTAwNzgxNTYxfQ.xP0Y02JZu-RqkId8sanHtrOoeOgBF027U3ooBNwpvZA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function verify() {
  console.log('=== Verifying Live Schema for Graduation Project System ===\n');

  // 1. Check user_role enum values
  console.log('--- 1. user_role enum values ---');
  const { data: roleEnum, error: roleError } = await supabase
    .from('profiles')
    .select('role')
    .limit(0);
  
  // Try fetching profiles with role = 'lecturer' to check if the enum value exists
  const { data: lecturerCheck, error: lecturerError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('role', 'lecturer')
    .limit(1);
  
  if (lecturerError) {
    console.log('❌ lecturer role enum check FAILED:', lecturerError.message);
    console.log('   This might mean "lecturer" is NOT a valid enum value.');
  } else {
    console.log('✅ lecturer is a valid role enum value (found', lecturerCheck?.length || 0, 'rows)');
  }

  // 2. Check notifications table columns
  console.log('\n--- 2. notifications table ---');
  const { data: notifData, error: notifError } = await supabase
    .from('notifications')
    .select('id, recipient_id, type, title, body, link, is_read, created_at')
    .limit(0);
  
  if (notifError) {
    console.log('❌ notifications table check FAILED:', notifError.message);
  } else {
    console.log('✅ notifications table exists with all expected columns');
    console.log('   Columns: id, recipient_id, type, title, body, link, is_read, created_at');
  }

  // 3. Check graduation_projects table columns
  console.log('\n--- 3. graduation_projects table ---');
  const { data: gpData, error: gpError } = await supabase
    .from('graduation_projects')
    .select('id, student_id, interest_statement, topic_title, topic_description, ai_suggested_topics, ai_suggested_lecturers, supervisor_id, status, created_at, updated_at')
    .limit(0);
  
  if (gpError) {
    console.log('❌ graduation_projects table check FAILED:', gpError.message);
  } else {
    console.log('✅ graduation_projects table exists with all expected columns');
  }

  // 4. Check profiles for new lecturer columns
  console.log('\n--- 4. profiles table - lecturer columns ---');
  const { data: profileCheck, error: profileError } = await supabase
    .from('profiles')
    .select('id, expertise_areas, lecturer_department_id')
    .limit(0);
  
  if (profileError) {
    console.log('❌ profiles expertise_areas/lecturer_department_id check FAILED:', profileError.message);
  } else {
    console.log('✅ profiles has expertise_areas and lecturer_department_id columns');
  }

  // 5. Check graduation_projects status values by attempting inserts with each status
  // (we can't easily check CHECK constraints without rpc, so just confirm table structure)
  console.log('\n--- 5. graduation_projects status CHECK constraint ---');
  console.log('   Expected statuses: choosing_topic, choosing_supervisor, pending_supervisor, active, completed, rejected_by_supervisor');
  
  // Check departments table (needed for admin lecturer creation)
  console.log('\n--- 6. departments table ---');
  const { data: deptData, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .limit(3);
  
  if (deptError) {
    console.log('❌ departments table check FAILED:', deptError.message);
  } else {
    console.log('✅ departments table accessible, sample:', deptData?.map(d => d.name));
  }

  // Check academic_plans (needed to find student department)
  console.log('\n--- 7. academic_plans table (for student dept lookup) ---');
  const { data: planData, error: planError } = await supabase
    .from('academic_plans')
    .select('id, name, department_id')
    .limit(3);
  
  if (planError) {
    console.log('❌ academic_plans check FAILED:', planError.message);
  } else {
    console.log('✅ academic_plans accessible:', planData?.map(p => `${p.name} (dept: ${p.department_id})`));
  }

  console.log('\n=== Verification Complete ===\n');
}

verify().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
