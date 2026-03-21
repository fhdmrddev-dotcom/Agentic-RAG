  UPDATE messages                                                                                     
  SET tool_calls = tool_calls::text::jsonb
  WHERE jsonb_typeof(tool_calls) = 'string'; 