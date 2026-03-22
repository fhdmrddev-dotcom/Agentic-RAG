 -- 2. Does full_markdown column exist?
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'documents' AND column_name = 'full_markdown';