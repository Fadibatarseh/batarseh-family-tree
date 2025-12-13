import { createClient } from '@supabase/supabase-js'

// I added the single quotes ' ' around the URL and the Key below
const supabaseUrl = 'https://aitlgoljcxztolqbilki.supabase.co'

// MAKE SURE THIS KEY IS ALSO WRAPPED IN QUOTES LIKE 'eyJ...'
// (I am using the start of the key you showed in the error log)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGxnb2xqY3h6dG9scWJpbGtp...'

export const supabase = createClient(supabaseUrl, supabaseKey)
