create table if not exists public.quiz_progress (user_id uuid primary key references auth.users(id) on delete cascade, answers jsonb not null default '{}'::jsonb, submitted jsonb not null default '{}'::jsonb, score integer not null default 0, completed boolean not null default false, updated_at timestamptz not null default now());
alter table public.quiz_progress enable row level security;
create policy "read own quiz progress" on public.quiz_progress for select using (auth.uid()=user_id);
create policy "insert own quiz progress" on public.quiz_progress for insert with check (auth.uid()=user_id);
create policy "update own quiz progress" on public.quiz_progress for update using (auth.uid()=user_id);
