-- One explicit ciphertext snapshot per account. No plaintext research or publishing tables.
begin;

create schema if not exists nestcipher_private;
revoke all on schema nestcipher_private from public, anon, authenticated;

create or replace function nestcipher_private.exact_json_keys(value jsonb, keys text[])
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if pg_catalog.jsonb_typeof(value) is distinct from 'object' then return false; end if;
  return value ?& keys and (select count(*) from pg_catalog.jsonb_object_keys(value)) = pg_catalog.cardinality(keys);
end;
$$;

create or replace function nestcipher_private.valid_base64(value jsonb, minimum integer, maximum integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare encoded text; decoded bytea;
begin
  if pg_catalog.jsonb_typeof(value) is distinct from 'string' then return false; end if;
  encoded := value #>> '{}';
  if pg_catalog.length(encoded) = 0 or pg_catalog.length(encoded) > ((maximum + 2) / 3) * 4
    or encoded !~ '^[A-Za-z0-9+/]+={0,2}$' or pg_catalog.length(encoded) % 4 <> 0 then return false; end if;
  decoded := pg_catalog.decode(encoded, 'base64');
  return pg_catalog.octet_length(decoded) between minimum and maximum
    and pg_catalog.replace(pg_catalog.encode(decoded, 'base64'), E'\n', '') = encoded;
exception when others then return false;
end;
$$;

create or replace function nestcipher_private.valid_cipher(value jsonb, maximum integer)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return nestcipher_private.exact_json_keys(value, array['iv', 'ciphertext'])
    and nestcipher_private.valid_base64(value->'iv', 12, 12)
    and nestcipher_private.valid_base64(value->'ciphertext', 16, maximum);
end;
$$;

create or replace function nestcipher_private.valid_encrypted_backup(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  header jsonb; kdf jsonb; record jsonb; ids text[] := '{}';
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if not nestcipher_private.exact_json_keys(value, array['format','version','backupId','header','manifest','records'])
    or value->>'format' is distinct from 'nestcipher-encrypted-research-vault'
    or value->'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(value->'backupId') is distinct from 'string'
    or (value->>'backupId') !~ uuid_pattern then return false; end if;
  header := value->'header'; kdf := header->'kdf';
  if not nestcipher_private.exact_json_keys(header, array['format','vaultId','kdf','check'])
    or header->'format' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(header->'vaultId') is distinct from 'string'
    or (header->>'vaultId') !~ uuid_pattern
    or not nestcipher_private.exact_json_keys(kdf, array['name','hash','iterations','salt'])
    or kdf->>'name' is distinct from 'PBKDF2' or kdf->>'hash' is distinct from 'SHA-256'
    or kdf->'iterations' is distinct from '600000'::jsonb
    or not nestcipher_private.valid_base64(kdf->'salt', 16, 16)
    or not nestcipher_private.valid_cipher(header->'check', 512)
    or not nestcipher_private.valid_cipher(value->'manifest', 16384)
    or pg_catalog.jsonb_typeof(value->'records') is distinct from 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(value->'records') > 25 then return false; end if;
  for record in select * from pg_catalog.jsonb_array_elements(value->'records') loop
    if not nestcipher_private.exact_json_keys(record, array['id','writeToken','iv','ciphertext'])
      or pg_catalog.jsonb_typeof(record->'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(record->'writeToken') is distinct from 'string'
      or (record->>'id') !~ uuid_pattern or (record->>'writeToken') !~ uuid_pattern
      or (record->>'id') = any(ids)
      or not nestcipher_private.valid_base64(record->'iv', 12, 12)
      or not nestcipher_private.valid_base64(record->'ciphertext', 16, 5251088) then return false; end if;
    ids := pg_catalog.array_append(ids, record->>'id');
  end loop;
  return true;
exception when others then return false;
end;
$$;

revoke all on all functions in schema nestcipher_private from public, anon, authenticated;

create table if not exists public.encrypted_research_backups (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  vault_id uuid not null,
  revision uuid not null default pg_catalog.gen_random_uuid(),
  snapshot jsonb not null,
  updated_at timestamptz not null default pg_catalog.now(),
  size_bytes integer generated always as (pg_catalog.octet_length(snapshot::text)) stored,
  record_count integer generated always as (pg_catalog.jsonb_array_length(snapshot->'records')) stored,
  constraint encrypted_backup_shape check (nestcipher_private.valid_encrypted_backup(snapshot)),
  constraint encrypted_backup_size check (pg_catalog.octet_length(snapshot::text) <= 3145728),
  constraint encrypted_backup_vault check ((snapshot->'header'->>'vaultId')::uuid = vault_id)
);

alter table public.encrypted_research_backups enable row level security;
revoke all on public.encrypted_research_backups from public, anon, authenticated;
grant select on public.encrypted_research_backups to authenticated;
drop policy if exists "Account reads only its encrypted backup" on public.encrypted_research_backups;
create policy "Account reads only its encrypted backup" on public.encrypted_research_backups
  for select to authenticated using (owner_id = (select auth.uid()));

create or replace function public.save_encrypted_research_backup(p_snapshot jsonb, p_expected_revision uuid)
returns table (revision uuid, vault_id uuid, updated_at timestamptz, size_bytes integer, record_count integer)
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); existing public.encrypted_research_backups%rowtype; incoming_vault uuid;
begin
  if owner is null then raise sqlstate 'PT401' using message = 'Sign in to save an encrypted backup.'; end if;
  if p_snapshot is null or pg_catalog.octet_length(p_snapshot::text) > 3145728 then
    raise sqlstate 'PT413' using message = 'The encrypted backup exceeds the storage limit.';
  end if;
  if not nestcipher_private.valid_encrypted_backup(p_snapshot) then
    raise sqlstate 'PT400' using message = 'The encrypted backup is invalid or unsupported.';
  end if;
  incoming_vault := (p_snapshot->'header'->>'vaultId')::uuid;
  -- Serialize the first insert too. A colliding hash only serializes unrelated owners.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 187341));
  select b.* into existing from public.encrypted_research_backups b where b.owner_id = owner for update;
  if found then
    if existing.vault_id <> incoming_vault then
      raise sqlstate 'PT409' using message = 'The account already backs up a different vault.', detail = 'vault-mismatch';
    end if;
    if p_expected_revision is distinct from existing.revision then
      raise sqlstate 'PT409' using message = 'The remote backup changed.', detail = 'conflict';
    end if;
    update public.encrypted_research_backups b set snapshot = p_snapshot,
      revision = pg_catalog.gen_random_uuid(), updated_at = pg_catalog.now() where b.owner_id = owner;
  else
    if p_expected_revision is not null then
      raise sqlstate 'PT409' using message = 'The remote backup changed.', detail = 'conflict';
    end if;
    insert into public.encrypted_research_backups(owner_id, vault_id, snapshot) values(owner, incoming_vault, p_snapshot);
  end if;
  return query select b.revision, b.vault_id, b.updated_at, b.size_bytes, b.record_count
    from public.encrypted_research_backups b where b.owner_id = owner;
end;
$$;

revoke all on function public.save_encrypted_research_backup(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_encrypted_research_backup(jsonb, uuid) to authenticated;

create or replace function public.delete_encrypted_research_backup(p_expected_revision uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); existing_revision uuid;
begin
  if owner is null then raise sqlstate 'PT401' using message = 'Sign in to delete an encrypted backup.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 187341));
  select b.revision into existing_revision from public.encrypted_research_backups b where b.owner_id = owner for update;
  if not found or p_expected_revision is distinct from existing_revision then
    raise sqlstate 'PT409' using message = 'The remote backup changed.', detail = 'conflict';
  end if;
  delete from public.encrypted_research_backups b where b.owner_id = owner;
end;
$$;
revoke all on function public.delete_encrypted_research_backup(uuid) from public, anon, authenticated;
grant execute on function public.delete_encrypted_research_backup(uuid) to authenticated;

commit;
