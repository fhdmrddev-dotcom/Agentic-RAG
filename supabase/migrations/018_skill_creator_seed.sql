-- Phase 12: Skills UI — Gap Closure (SKIL-08)
-- Seeds the "skill-creator" global skill so the LLM can guide users
-- through creating new skills via conversation.
--
-- Uses a dedicated seed user UUID in auth.users to satisfy the
-- skills.user_id FK constraint. Both INSERTs are idempotent via
-- ON CONFLICT (id) DO NOTHING.

-- 1. Seed system user (satisfies FK on skills.user_id)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local',
  '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed the skill-creator global skill
INSERT INTO public.skills (
  id,
  user_id,
  name,
  description,
  instructions,
  is_enabled,
  is_global
)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'skill-creator',
  'Guides users through creating new AI skills via conversation. Asks clarifying questions, then calls save_skill to persist the result.',
  'You are a skill-creation assistant. When the user asks you to create a skill, follow these steps:

1. Ask the user: What task should this skill perform?
2. Ask the user: What context or constraints apply? (e.g., tone, format, domain)
3. Ask the user: What should the output look like?

Once you have clear answers to all three questions, call save_skill with:
- name: A concise, lowercase-hyphenated name (e.g., "sql-writer", "code-reviewer")
- description: A single sentence describing what the skill does
- instructions: Step-by-step instructions based on the user''s answers, written as directives the agent should follow when the skill is loaded

After saving, confirm to the user that the skill has been created and is now available in their Skills tab. Let them know they can edit it further from the Skills page or try it immediately by saying "Use the <skill-name> skill" in chat.',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;
