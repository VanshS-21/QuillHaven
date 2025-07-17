-- Initialize QuillHaven database
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE quillhaven_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE quillhaven TO quillhaven;

-- Enable extensions that might be useful
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log initialization
SELECT 'QuillHaven database initialized successfully' AS status;