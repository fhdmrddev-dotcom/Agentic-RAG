-- Module 7: Text-to-SQL tool
-- Creates a safe RPC for querying the documents table.
-- SECURITY INVOKER ensures RLS policies apply — users can only see their own rows.

CREATE OR REPLACE FUNCTION query_user_documents(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result jsonb;
  clean_query text;
BEGIN
  clean_query := trim(sql_query);

  -- Injection guard: SELECT only, no semicolons
  IF lower(clean_query) NOT LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;
  IF position(';' IN clean_query) > 0 THEN
    RAISE EXCEPTION 'Query must be a single statement (no semicolons)';
  END IF;

  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', clean_query)
    INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION query_user_documents(text) TO authenticated;
