# Software Requirements Specification (SRS)

Project: Study Buddy  
Version: 1.0

---

## 1. Introduction

### 1.1 Purpose

This document describes the requirements for Study Buddy, an aesthetic study planner app that combines scheduling, Pomodoro focus tools, motivation features, and DSA tracking in one place.

The goal is to clearly define what the app should do before development begins.

---

### 1.2 Scope

Study Buddy is a web application that helps students and self-learners:

- Plan weekly study routines  
- Sync schedules with Google Calendar  
- Stay focused using Pomodoro timers  
- Track Striver’s DSA Sheet progress  
- Automatically balance learning and revision days  
- Stay motivated with quotes, streaks, and summaries  

The app focuses on being simple, guided, and visually calming rather than complex like Notion.

---

### 1.3 Target Users

- College students preparing for placements  
- Learners practicing DSA consistently  
- Anyone wanting an aesthetic productivity planner  

---

## 2. Overall Description

### 2.1 Product Overview

Study Buddy provides an all-in-one productivity system where users can log in, connect their calendar, and immediately start following a structured weekly plan.

Core modules include:

- Weekly Planner  
- Pomodoro Timer  
- DSA Tracker  
- Motivation System  
- Calendar Integration  

---

### 2.2 Main Objectives

- Reduce friction in study planning  
- Help users maintain consistency  
- Provide built-in structure for revision  
- Make productivity enjoyable and aesthetic  

---

## 3. Functional Requirements

### 3.1 Authentication

- Users must be able to sign up and log in using Clerk  
- Users must be able to log out securely  
- Each user must have a private dashboard  

---

### 3.2 Dashboard

The dashboard must display:

- Weekly study schedule  
- Today’s tasks  
- Pomodoro focus button  
- DSA progress summary  
- Motivation quote of the day  

---

### 3.3 Google Calendar Integration

- Users can connect their Google Calendar account  
- The system can display calendar events inside Study Buddy  
- The system can add study sessions as calendar blocks  
- Sync must not overwrite existing user events  

---

### 3.4 Weekly Study Planner

- Users can generate a weekly routine based on preferences  

Default structure:

- 2 days learning new DSA topics  
- 2 days revision of solved questions  
- 1 day mixed practice  
- Weekends as rest or optional catch-up  

- Users can reschedule missed tasks  

---

### 3.5 Pomodoro Timer

Built-in Pomodoro modes:

- 25/5  
- 50/10  
- Custom durations  

Timer must support:

- Start  
- Pause  
- Reset  
- Session completion tracking  

---

### 3.6 Motivation System

- Display daily motivational quotes  
- Track study streaks  
- Provide weekly progress summaries  

---

### 3.7 Striver DSA Sheet Tracker

- Users can browse DSA topics and questions  
- Users can mark questions as:

  - Completed  
  - Needs Revision  

- The system should generate revision reminders automatically  

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Dashboard load time should be under 2 seconds  
- Pomodoro timer must run reliably without lag  

---

### 4.2 Security

- OAuth must be used for Google Calendar  
- User data must be isolated per account  
- Secure session management via Clerk  

---

### 4.3 Usability

- Minimal clicks to start studying  
- Mobile responsive layout  
- Calm aesthetic UI with planner-like feel  

---

### 4.4 Scalability

- System should support thousands of users  
- Modular design for adding features later  

---

## 5. MVP Requirements (Phase 1)

The first release should include:

- Clerk authentication  
- Dashboard  
- Pomodoro timer  
- Weekly planner generation  
- Manual DSA tracker  
- Quotes and streak counter  

Google Calendar sync can be Phase 2.
