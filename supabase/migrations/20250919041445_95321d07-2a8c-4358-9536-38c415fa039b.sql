-- Update "tru wealth beats" user to be a producer
UPDATE profiles 
SET role = 'producer'
WHERE LOWER(first_name || ' ' || last_name) LIKE '%tru wealth beats%' 
   OR LOWER(producer_name) LIKE '%tru wealth beats%'
   OR EXISTS (
     SELECT 1 FROM auth.users 
     WHERE auth.users.id = profiles.id 
     AND LOWER(auth.users.email) LIKE '%tru%wealth%beats%'
   );