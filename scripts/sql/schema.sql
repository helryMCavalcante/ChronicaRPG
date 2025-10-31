-- PERFIS
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  created_at timestamp with time zone default now()
);

-- SALAS
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_private boolean default false,
  owner uuid references auth.users not null,
  created_at timestamp with time zone default now()
);

-- MEMBROS DA SALA
create table if not exists room_members (
  room_id uuid references rooms on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text check (role in ('OWNER','CO_GM','PLAYER')) default 'PLAYER',
  joined_at timestamp with time zone default now(),
  primary key (room_id, user_id)
);

-- MENSAGENS
create table if not exists messages (
  id bigserial primary key,
  room_id uuid references rooms on delete cascade,
  user_id uuid references auth.users on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

-- ROLAGENS DE DADOS
create table if not exists rolls (
  id bigserial primary key,
  room_id uuid references rooms on delete cascade,
  user_id uuid references auth.users on delete cascade,
  formula text not null,
  result jsonb not null,
  created_at timestamp with time zone default now()
);

-- PRESENÇA
create table if not exists presence (
  room_id uuid references rooms on delete cascade,
  user_id uuid references auth.users on delete cascade,
  last_seen timestamp with time zone not null default now(),
  primary key (room_id, user_id)
);

create index if not exists messages_room_idx on messages(room_id);
create index if not exists rolls_room_idx on rolls(room_id);
create index if not exists presence_room_idx on presence(room_id);
