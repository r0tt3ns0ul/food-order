-- Выполни весь SQL в Supabase → SQL Editor → New query → Run

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  price integer not null default 0 check (price >= 0),
  image_url text,
  available boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  pc_number text not null,
  items jsonb not null,
  total integer not null check (total >= 0),
  status text not null default 'new'
    check (status in ('new','accepted','cooking','ready','completed','cancelled')),
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Все операции выполняются сервером Vercel с service_role key.
-- Не добавляй service_role key в HTML или публичный JavaScript.

insert into public.products (name, description, category, price, sort_order)
select v.name, v.description, v.category, v.price, v.sort_order
from (values
 ('Классический бургер','Сочная котлета, сыр, свежие овощи и фирменный соус.','Бургеры',1600,10),
 ('Чизбургер','Говяжья котлета, двойной сыр и фирменный соус.','Бургеры',1800,20),
 ('Донер','Мясо, овощи и соус в мягкой лепёшке.','Донеры',1700,30),
 ('Донер с курицей','Курица, свежие овощи и нежный соус.','Донеры',1500,40),
 ('Картофель фри','Золотистый картофель с солью.','Снеки',700,50),
 ('Наггетсы','Хрустящие куриные кусочки.','Снеки',1100,60),
 ('Coca-Cola','Холодный напиток, 0.5 л.','Напитки',500,70),
 ('Вода','Питьевая вода, 0.5 л.','Напитки',300,80)
) as v(name,description,category,price,sort_order)
where not exists (select 1 from public.products);
