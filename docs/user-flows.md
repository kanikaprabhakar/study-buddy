# User Flows and Use Cases

This document describes how users interact with Study Buddy.

---

## Flow 1: Sign Up and Dashboard Entry

1. User opens Study Buddy  
2. User signs up using Clerk  
3. User is redirected to dashboard  
4. Dashboard shows weekly planner + focus tools  

---

## Flow 2: Weekly Plan Generation

1. User clicks "Generate Weekly Plan"  
2. User selects intensity/preferences  
3. System creates tasks for the week:

- Learning days  
- Revision days  
- Practice day  
- Rest days  

4. Tasks appear in dashboard calendar view  

---

## Flow 3: Completing Study Tasks

1. User opens today’s task list  
2. User marks tasks as completed  
3. Completed tasks update streak and progress  

---

## Flow 4: Pomodoro Focus Session

1. User clicks "Start Focus Session"  
2. Timer runs for chosen duration  
3. User completes session  
4. Session saved to pomodoro_sessions table  
5. Dashboard updates focus stats  

---

## Flow 5: Striver DSA Sheet Tracking

1. User opens DSA Tracker  
2. User browses topic list  
3. User marks a question as completed  
4. System optionally flags revision due date  
5. Progress updates per topic  

---

## Flow 6: Motivation and Streaks

1. User logs in daily  
2. Quote of the day is displayed  
3. Streak increases if tasks are completed  
4. Weekly summary provides encouragement and stats  

---

## Flow 7 (Phase 2): Google Calendar Sync

1. User connects Google Calendar  
2. Study Buddy reads weekly events  
3. Study sessions are added as calendar blocks  
4. Sync does not overwrite personal events  
