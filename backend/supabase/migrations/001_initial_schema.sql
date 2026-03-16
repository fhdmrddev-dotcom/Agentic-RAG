-- Enable pgvector extension (needed for Module 2+)
create extension if not exists vector;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- threads
-- ============================================================
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  openai_thread_id text not null default '',
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.threads enable row level security;

create policy "Users can view their own threads"
  on public.threads for select
  using (auth.uid() = user_id);

create policy "Users can insert their own threads"
  on public.threads for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own threads"
  on public.threads for update
  using (auth.uid() = user_id);

create policy "Users can delete their own threads"
  on public.threads for delete
  using (auth.uid() = user_id);

-- ============================================================
-- messages
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can view their own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own messages"
  on public.messages for update
  using (auth.uid() = user_id);

create policy "Users can delete their own messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_threads_updated_at
  before update on public.threads
  for each row execute procedure public.set_updated_at();

create trigger set_messages_updated_at
  before update on public.messages
  for each row execute procedure public.set_updated_at();
