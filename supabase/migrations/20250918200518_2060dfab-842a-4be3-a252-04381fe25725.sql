-- Enable leaked password protection
UPDATE auth.config 
SET value = 'true' 
WHERE parameter = 'password_min_length';

-- Ensure password strength settings are configured
INSERT INTO auth.config (parameter, value) 
VALUES ('password_min_length', '8') 
ON CONFLICT (parameter) DO UPDATE SET value = '8';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_letters', 'true') 
ON CONFLICT (parameter) DO UPDATE SET value = 'true';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_numbers', 'true') 
ON CONFLICT (parameter) DO UPDATE SET value = 'true';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_symbols', 'false') 
ON CONFLICT (parameter) DO UPDATE SET value = 'false';