-- Ejecuta este script en Supabase → SQL Editor

-- TABLA: tarjetas
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  bank text,
  color text default 'blue',
  cut_day integer not null check (cut_day between 1 and 31),
  pay_day integer not null check (pay_day between 1 and 31),
  credit_limit numeric(12,2) default 0,
  balance numeric(12,2) default 0,
  min_payment numeric(12,2) default 0,
  interest_rate numeric(5,2) default 0,
  notes text,
  created_at timestamptz default now()
);

-- TABLA: pagos
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references cards(id) on delete cascade not null,
  amount numeric(12,2) not null,
  date date not null,
  type text check (type in ('minimum','partial','full')) default 'full',
  notes text,
  created_at timestamptz default now()
);

-- SEGURIDAD: cada usuario solo ve sus propios datos
alter table cards enable row level security;
alter table payments enable row level security;

create policy "cards: solo el dueño" on cards
  for all using (auth.uid() = user_id);

create policy "payments: solo el dueño" on payments
  for all using (auth.uid() = user_id);
