create extension if not exists "pgcrypto";

comment on extension "pgcrypto" is 'Provides gen_random_uuid() for primary keys.';
