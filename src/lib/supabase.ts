import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gswiyvjqpxhqbgnavzsq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdzd2l5dmpxcHhocWJnbmF2enNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODE4MjMxMCwiZXhwIjoyMDkzNzU4MzEwfQ.ZqBL2wDp4DfgSFWMDbMewlySxabzMTsfPnfRTbyd-xY';

export const supabase = createClient(supabaseUrl, supabaseKey);
