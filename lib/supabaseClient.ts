import { createClient } from '@supabase/supabase-js';

// Browser client using the public (anon/publishable) key. Reads/writes go
// straight from the device to Supabase; RLS allows the anon role.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
