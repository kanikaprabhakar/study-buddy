import sql from "../supabase.js";

export async function upsertClerkUser(user) {
	const emailList = user.email_addresses ?? [];
	const primaryEmail =
		emailList.find((item) => item.id === user.primary_email_address_id)?.email_address ??
		emailList[0]?.email_address ??
		null;

	const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
	const displayName = fullName || user.username || "Zenith User";

	if (primaryEmail) {
		await sql`
			update public.users
			set clerk_id = ${user.id}, name = ${displayName}
			where email = ${primaryEmail}
				and (clerk_id is null or clerk_id <> ${user.id})
		`;
	}

	await sql`
		insert into public.users (clerk_id, name, email)
		values (${user.id}, ${displayName}, ${primaryEmail})
		on conflict (clerk_id)
		do update set
			name = excluded.name,
			email = excluded.email
	`;
}

export async function ensureUsersSchema() {
	await sql`create extension if not exists pgcrypto`;
	await sql`alter table public.users add column if not exists clerk_id text`;
	await sql`alter table public.users alter column id set default gen_random_uuid()`;
	await sql`
		create unique index if not exists users_clerk_id_key
		on public.users (clerk_id)
	`;
}

export async function ensureTasksSchema() {
	await sql`
		create table if not exists public.tasks (
			id         uuid primary key default gen_random_uuid(),
			clerk_id   text not null,
			title      text not null,
			deadline   date,
			priority   text not null default 'medium',
			done       boolean not null default false,
			created_at timestamptz not null default now()
		)
	`;
	await sql`create index if not exists tasks_clerk_id_idx on public.tasks (clerk_id)`;
	await sql`alter table public.tasks add column if not exists completed_on date`;
}

export async function ensureSessionsSchema() {
	await sql`
		create table if not exists public.study_sessions (
			id           uuid primary key default gen_random_uuid(),
			clerk_id     text not null,
			duration_min integer not null default 25,
			mode         text not null default 'focus',
			studied_on   date not null default current_date,
			created_at   timestamptz not null default now()
		)
	`;
	await sql`create index if not exists study_sessions_clerk_id_idx on public.study_sessions (clerk_id)`;
	await sql`
		create index if not exists study_sessions_studied_on_idx
		on public.study_sessions (clerk_id, studied_on)
	`;
}

export async function ensureResourcesSchema() {
	await sql`
		create table if not exists public.resources (
			id          uuid primary key default gen_random_uuid(),
			clerk_id    text not null,
			name        text not null,
			url         text not null,
			description text,
			created_at  timestamptz not null default now()
		)
	`;
	await sql`create index if not exists resources_clerk_id_idx on public.resources (clerk_id)`;
}

export async function ensureNotesSchema() {
	await sql`
		create table if not exists public.notes (
			id          uuid primary key default gen_random_uuid(),
			clerk_id    text not null,
			heading     text not null default 'Untitled',
			description text,
			content     text not null default '',
			created_at  timestamptz not null default now(),
			updated_at  timestamptz not null default now()
		)
	`;
	await sql`create index if not exists notes_clerk_id_idx on public.notes (clerk_id)`;
}

export async function ensureCalendarSchema() {
	await sql`alter table public.calendar_connections add column if not exists clerk_id text`;
	await sql`alter table public.calendar_connections add column if not exists access_token text`;
	await sql`alter table public.calendar_connections add column if not exists token_expiry timestamptz`;
	await sql`alter table public.calendar_connections add column if not exists gcal_email text`;
	try {
		await sql`
			create unique index if not exists cal_conn_clerk_provider_key
			on public.calendar_connections (clerk_id, provider)
			where clerk_id is not null
		`;
	} catch { /* index already exists */ }
}
