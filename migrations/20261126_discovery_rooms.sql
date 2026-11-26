-- Public discovery rooms v1. Anonymous, consent-gated group discussion.

create table if not exists discovery_rooms (
  id text primary key,
  topic text not null,
  question text,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  created_at timestamptz not null default now()
);
create table if not exists discovery_room_messages (
  id text primary key,
  room_id text not null references discovery_rooms(id) on delete cascade,
  parent_id text,
  author_kind text not null default 'human' check (author_kind in ('human','ai','system')),
  role text not null default 'participant' check (role in ('participant','facilitator')),
  text text not null,
  consent boolean not null default false,
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED','HIDDEN')),
  content_hash text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists discovery_room_messages_room_idx on discovery_room_messages(room_id, created_at);
