import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const ts = Date.now();
  const email = `test-${ts}@university.edu`
  const password = 'password123'
  
  console.log('Testing signup with', email)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Audit User'
      }
    }
  })
  
  if (error) {
    console.error('Signup error:', error.message)
    process.exit(1)
  }
  
  console.log('Signup successful. User ID:', data.user.id)
  
  console.log('Verifying profile auto-creation via trigger...')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()
    
  if (profileError) {
    console.error('Profile fetch error:', profileError.message)
    process.exit(1)
  }
  
  console.log('Profile created successfully:', profile)
  
  console.log('Testing specific onboarding profile update...')
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ major: 'Computer Science', year_of_study: 'Junior (Year 3)' })
    .eq('id', data.user.id)
    
  if (updateError) {
    console.error('Profile update error:', updateError.message)
    process.exit(1)
  }
  
  console.log('Profile successfully updated (simulated onboarding completion)')
}

test()
