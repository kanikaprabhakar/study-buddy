# Database Schema Design

Zenith (Supabase Postgres)

---

## 1. Overview

This schema supports the core Zenith features:

- User profiles  
- Study planning  
- Pomodoro sessions  
- DSA tracking  
- Calendar-linked scheduling  

Supabase will store structured planner and progress data.

---

## 2. Tables

---

### 2.1 users

Stores basic user profile info.

| Column Name       | Type      | Notes |
|------------------|----------|------|
| id               | UUID     | Primary key (generated in DB) |
| clerk_id         | Text     | Unique Clerk user id (e.g. user_xxx) |
| name             | Text     | Display name |
| email            | Text     | Unique |
| theme_preference | Text     | Light/pastel themes |
| streak_count     | Integer  | Current streak |
| created_at       | Timestamp| Auto-generated |

---

### 2.2 study_tasks

Stores scheduled study activities.

| Column Name     | Type      | Notes |
|----------------|----------|------|
| id             | UUID     | Primary key |
| user_id        | UUID     | Foreign key → users.id |
| title          | Text     | Task name |
| task_type      | Text     | DSA / Revision / Study |
| scheduled_date | Date     | Planned day |
| status         | Text     | Pending / Completed / Missed |
| created_at     | Timestamp| Auto |

---

### 2.3 pomodoro_sessions

Tracks completed focus sessions.

| Column Name   | Type      | Notes |
|--------------|----------|------|
| id           | UUID     | Primary key |
| user_id      | UUID     | Foreign key |
| duration     | Integer  | Minutes |
| completed_at | Timestamp| When finished |

---

### 2.4 dsa_questions

Master list of Striver sheet questions.

| Column Name   | Type   | Notes |
|--------------|--------|------|
| id           | UUID   | Primary key |
| topic        | Text   | Arrays, DP, Graphs |
| question     | Text   | Question title |
| link         | Text   | LeetCode/GFG link |

---

### 2.5 dsa_progress

Tracks per-user progress on questions.

| Column Name       | Type      | Notes |
|------------------|----------|------|
| id               | UUID     | Primary key |
| user_id          | UUID     | Foreign key |
| question_id      | UUID     | Foreign key → dsa_questions.id |
| completed        | Boolean  | Done or not |
| needs_revision   | Boolean  | Revision flag |
| revision_due     | Date     | Next revision date |

---

### 2.6 quotes

Stores motivational quotes.

| Column Name   | Type   | Notes |
|--------------|--------|------|
| id           | UUID   | Primary key |
| text         | Text   | Quote content |
| author       | Text   | Optional |
| category     | Text   | Optional mood/topic |

---

### 2.7 calendar_connections

Stores Google Calendar integration metadata.

| Column Name     | Type      | Notes |
|----------------|----------|------|
| id             | UUID     | Primary key |
| user_id        | UUID     | Foreign key |
| provider       | Text     | Google |
| refresh_token  | Text     | Stored securely |
| connected_at   | Timestamp| When linked |

---

## 3. Relationships Summary

- One user → many study_tasks  
- One user → many pomodoro_sessions  
- One user → many dsa_progress entries  
- One question → many user progress entries  
- One user → one calendar connection  

---

## 4. Schema Notes

- Clerk handles authentication; Supabase stores app-specific data  
- DSA questions table is seeded once  
- Revision scheduling can be computed later with spaced repetition logic  

---

## 5. Clerk Sync SQL (Required)

Use UUID primary IDs plus `clerk_id` text for Clerk mapping.

```sql
create table if not exists public.users (
	id uuid primary key default gen_random_uuid(),
	clerk_id text unique,
	name text,
	email text unique,
	theme_preference text,
	streak_count integer default 0,
	created_at timestamptz default now()
);
```

If your table already exists:

```sql
create extension if not exists pgcrypto;
alter table public.users add column if not exists clerk_id text;
alter table public.users alter column id set default gen_random_uuid();
create unique index if not exists users_clerk_id_key on public.users(clerk_id);
```
