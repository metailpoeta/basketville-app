import { createClient } from '@supabase/supabase-js';

// Incolla qui l'URL del tuo progetto Supabase
const supabaseUrl = 'https://knifyfuuaseyfovdszij.supabase.co';

// Incolla qui la chiave "anon public" lunghissima
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuaWZ5ZnV1YXNleWZvdmRzemlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzQwNjYsImV4cCI6MjA5MjYxMDA2Nn0.9g7KnK5XLuvFiAsvWosKmXol0PMLDknNj7ksnP-HGDo';

export const supabase = createClient(supabaseUrl, supabaseKey);