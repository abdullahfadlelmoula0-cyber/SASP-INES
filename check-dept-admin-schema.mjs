import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mzkuhyccdccjtimzmwqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3VoeWNjZGNjanRpbXptd3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNTU2MSwiZXhwIjoyMTAwNzgxNTYxfQ.xP0Y02JZu-RqkId8sanHtrOoeOgBF027U3ooBNwpvZA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDepartmentAdminSchema() {
  console.log('=== Checking Department Admin Schema ===\n');
  
  // Check profiles table for managed_department_id
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, managed_department_id, department')
    .limit(5);
  
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  } else {
    console.log('Sample profiles:');
    profiles?.forEach(p => {
      console.log(`- ${p.full_name} (role: ${p.role}, dept: ${p.department}, manages: ${p.managed_department_id || 'N/A'})`);
    });
  }
  
  // Check if departments table exists
  console.log('\n=== Checking Departments Table ===\n');
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .limit(5);
  
  if (deptError) {
    console.log('Departments table:', deptError.message);
  } else {
    console.log('Available departments:');
    departments?.forEach(d => console.log(`- ${d.name} (ID: ${d.id})`));
  }
  
  // Check existing helper functions
  console.log('\n=== Checking Helper Functions ===\n');
  
  // Test is_admin function
  const { data: adminCheck, error: adminErr } = await supabase.rpc('is_admin');
  console.log('is_admin() function:', adminErr ? 'MISSING' : 'EXISTS');
  
  // Check for can_manage_announcement function
  try {
    const { error } = await supabase.rpc('can_manage_announcement', { p_academic_plan_id: null });
    console.log('can_manage_announcement() function:', error ? 'MISSING' : 'EXISTS');
  } catch (e) {
    console.log('can_manage_announcement() function: MISSING');
  }
  
  // Check courses table structure
  console.log('\n=== Checking Courses Table ===\n');
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('id, code, title, department, academic_plan_id')
    .limit(3);
  
  if (courseError) {
    console.error('Error fetching courses:', courseError);
  } else {
    console.log(`Found ${courses?.length || 0} sample courses`);
    courses?.forEach(c => {
      console.log(`- ${c.code}: ${c.title} (dept: ${c.department || 'N/A'}, plan: ${c.academic_plan_id || 'N/A'})`);
    });
  }
  
  // Check existing RLS policies
  console.log('\n=== Checking RLS Policies ===\n');
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('tablename, policyname')
    .in('tablename', ['profiles', 'courses', 'announcements', 'documents'])
    .limit(20);
  
  if (policies) {
    const grouped = {};
    policies.forEach(p => {
      if (!grouped[p.tablename]) grouped[p.tablename] = [];
      grouped[p.tablename].push(p.policyname);
    });
    
    Object.entries(grouped).forEach(([table, pols]) => {
      console.log(`\n${table}:`);
      pols.forEach(p => console.log(`  - ${p}`));
    });
  }
}

checkDepartmentAdminSchema().then(() => {
  console.log('\n=== Schema Check Complete ===');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
