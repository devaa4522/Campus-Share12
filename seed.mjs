import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nfqptzssqcdgnfwqrngs.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.log("Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node seed.mjs");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("Starting DB seeding...");

  // 1. Create 5 users
  const users = [
    { email: 'amy.smith@university.edu', password: 'password123', name: 'Amy Smith', major: 'Computer Science', year: 'Senior' },
    { email: 'bob.jones@university.edu', password: 'password123', name: 'Bob Jones', major: 'Engineering', year: 'Junior' },
    { email: 'charlie.brown@university.edu', password: 'password123', name: 'Charlie Brown', major: 'Medical Sciences', year: 'Graduate' },
    { email: 'diana.prince@university.edu', password: 'password123', name: 'Diana Prince', major: 'Arts', year: 'Sophomore' },
    { email: 'evan.wright@university.edu', password: 'password123', name: 'Evan Wright', major: 'Physics', year: 'Freshman' }
  ];

  const createdUsers = [];
  for (const u of users) {
    const { data: { user }, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        full_name: u.name
      }
    });

    if (error) {
      console.log(`Error creating ${u.email}:`, error.message);
      // Try to fetch existing profile
      const { data: existingUser } = await supabase.from('profiles').select('*').eq('full_name', u.name).single();
      if (existingUser) {
          createdUsers.push(existingUser);
      }
    } else {
        // Wait a small moment to ensure trigger creates the profile
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update profile details
        await supabase.from('profiles').update({
            full_name: u.name,
            major: u.major,
            year_of_study: u.year,
            is_verified: true,
            karma_score: 1250
        }).eq('id', user.id);
        
        // Refetch profile to get full object
        const { data: updatedUser } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updatedUser) {
            createdUsers.push(updatedUser);
        }
    }
  }

  if (createdUsers.length === 0) {
      console.error("No users available to attach items to. Exiting.");
      return;
  }

  console.log(`Verified ${createdUsers.length} users.`);

  // 2. Insert 10 items
  const items = [
    { title: 'TI-84 Plus Graphing Calculator', description: 'Used but working perfectly.', category: 'Engineering', condition: 'Good', price_type: 'Rental', price_amount: 15, status: 'available' },
    { title: 'Organic Chemistry Lab Coat', description: 'Size M. Cleaned and ready for lab.', category: 'Science', condition: 'Like New', price_type: 'Free', price_amount: 0, status: 'available' },
    { title: 'Human Anatomy Atlas 7th Ed', description: 'Hardcover, no highlighting.', category: 'Medical', condition: 'Excellent', price_type: 'Rental', price_amount: 25, status: 'available' },
    { title: 'Drafting Table Kit', description: 'Includes scales, T-square and triangles.', category: 'Arts', condition: 'Fair', price_type: 'Rental', price_amount: 10, status: 'available' },
    { title: 'Leica Microscope Time-slot', description: 'Borrowing my booked time in Lab A.', category: 'Science', condition: 'Excellent', price_type: 'Free', price_amount: 0, status: 'available' },
    { title: 'Digital Signal Processing Notes', description: 'Detailed notes and past papers.', category: 'Engineering', condition: 'Good', price_type: 'Free', price_amount: 0, status: 'available' },
    { title: 'Premium Stethoscope', description: 'Littmann Classic III', category: 'Medical', condition: 'Excellent', price_type: 'Rental', price_amount: 12, status: 'available' },
    { title: 'Arduino Starter Kit', description: 'Almost complete, missing one LED.', category: 'Engineering', condition: 'Good', price_type: 'Rental', price_amount: 5, status: 'available' },
    { title: 'Canvas Portfolios & Oil Paints', description: 'Leftover from last semester.', category: 'Arts', condition: 'Good', price_type: 'Free', price_amount: 0, status: 'available' },
    { title: 'Intro to Economics Book', description: 'For ECON101.', category: 'Arts', condition: 'Good', price_type: 'Rental', price_amount: 15, status: 'rented' }
  ];

  // Distribute items among created users
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.user_id = createdUsers[i % createdUsers.length].id;
  }
  
  // clear items first for clean seeding (optional, but good)
  console.log("Emptying items table...");
  await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: insertError } = await supabase.from('items').insert(items);
  if (insertError) {
      console.error("Error inserting items:", insertError);
  } else {
      console.log("Successfully seeded 10 academic items!");
  }
}

main().catch(console.error);
