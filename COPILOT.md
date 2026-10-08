# Mobile To-Do App — Implementation Specification

You are acting as a coding agent responsible for implementing this project.

Your goal is to build a complete mobile to-do application according to the specification below.

You may choose appropriate libraries, project structure, architecture, and implementation details unless they are explicitly constrained.

However, you MUST document the development process continuously in a file named:

`BUILD_LOG.md`

Do not wait until the end of the project to create this file.

Keep it updated throughout development.

---

# 1. Development Log Requirement

Create `BUILD_LOG.md` at the beginning of the project.

For every relevant development interaction, decision, implementation step, bug, or correction, append a new entry.

Each entry should contain:

## Prompt / Request

Record the user request that led to the change.

Preserve the original wording whenever practical.

## Decision Summary

Briefly explain:

- what you decided to do;
- what libraries or APIs you selected;
- important architectural decisions;
- assumptions you made;
- alternatives considered when relevant.

Provide a concise reasoning summary only.

Do not expose private hidden chain-of-thought.

## Actions Performed

Describe what changed.

Examples:

- files created;
- files modified;
- dependencies installed;
- database schema changed;
- navigation added;
- notification support added;
- components refactored.

## Result

Describe the result of the change.

Examples:

- feature implemented successfully;
- build succeeded;
- build failed;
- feature partially works;
- runtime error occurred;
- notification did not trigger.

## Problems / Errors

Record relevant:

- compiler errors;
- runtime errors;
- incorrect assumptions;
- bugs;
- unexpected behavior.

## Fixes Attempted

Record attempts made to solve problems, including unsuccessful attempts when relevant.

## Current Status

Mark the feature or step as one of:

- Completed
- Partially completed
- Broken
- Needs testing
- Blocked

The purpose of `BUILD_LOG.md` is to preserve the real development history.

Do not rewrite previous entries merely to make the development process appear cleaner.

If an earlier decision turns out to be wrong, keep the old entry and create a new entry describing the correction.

---

# 2. Project Goal

Build a mobile to-do application with:

- SQLite persistence;
- multiple screens;
- task categories;
- task filtering;
- optional due date and time;
- scheduled local notifications.

The application must continue to work after being closed and reopened.

---

# 3. Task Data Model

A task must contain at least:

- `id`
- `title`
- `description`
- `completed`
- `dueDateTime`
- `createdAt`
- `categoryId`

Requirements:

- `id` must uniquely identify the task;
- `title` is required;
- `description` is optional;
- `completed` indicates whether the task has been completed;
- `dueDateTime` is optional;
- `createdAt` must record when the task was created;
- `categoryId` is optional.

You may add additional fields if they are useful for the implementation.

Document any additional fields in `BUILD_LOG.md`.

---

# 4. Category Data Model

A category must contain at least:

- `id`
- `name`

Examples:

- Personal
- Work
- Study
- Shopping

You may optionally add properties such as:

- color;
- icon;
- description.

Categories must be stored persistently in SQLite.

---

# 5. SQLite Persistence

Use SQLite for local persistence.

At minimum, the database must persist:

- tasks;
- categories.

Data must remain available after:

- navigating between screens;
- closing the app;
- reopening the app;
- restarting the emulator or device.

You may choose an appropriate SQLite library, ORM, abstraction layer, DAO, repository, or direct SQL approach.

Document the selected approach in `BUILD_LOG.md`.

---

# 6. Required Screens

The application must contain at least three screens.

---

## Screen 1 — Task List

This is the main application screen.

Display stored tasks.

Each task should visibly show at least:

- title;
- completed/pending state;
- category, if one exists;
- due date/time, if one exists.

The screen must allow the user to filter tasks by status:

- All
- Pending
- Completed

The screen must also allow filtering by category.

The exact UI is up to you.

Examples:

- chips;
- tabs;
- dropdown;
- segmented control;
- buttons.

The user must be able to:

- create a new task;
- open an existing task;
- mark a task as completed or pending;
- navigate to category management.

---

## Screen 2 — Task Editor / Detail

This screen must allow creating and editing tasks.

Editable fields:

- title;
- description;
- due date;
- due time;
- category;
- completed status.

Requirements:

- title is required;
- category is optional;
- due date/time is optional.

When editing an existing task, populate the form with its current values.

The user must be able to:

- save;
- cancel;
- delete an existing task.

---

## Screen 3 — Category Management

This screen must allow the user to:

- list existing categories;
- create a category;
- rename a category;
- delete a category.

You must decide what happens when a category that is currently used by tasks is deleted.

Possible strategies include:

- tasks become uncategorized;
- deletion is blocked;
- tasks are reassigned;
- another sensible approach.

Document the selected behavior in `BUILD_LOG.md`.

---

# 7. Navigation

Implement navigation between the required screens.

The application must demonstrate navigation between:

1. Task List
2. Task Editor / Detail
3. Category Management

When opening an existing task for editing, choose an appropriate strategy for transferring data.

Examples:

- pass only the task ID;
- pass the full task object;
- use shared application state;
- another suitable approach.

Document the chosen strategy in `BUILD_LOG.md`.

---

# 8. Task Operations

The application must support:

## Create

Create a new task and persist it to SQLite.

## Edit

Edit an existing task and persist the changes.

## Complete / Reopen

The user must be able to:

- mark a pending task as completed;
- mark a completed task as pending again.

## Delete

Delete a task from SQLite.

If the task has an associated scheduled notification, cancel it.

---

# 9. Due Dates

Tasks may have an optional due date and time.

If no due date/time is selected, the task must work normally without a reminder.

If a future date/time is selected, schedule a local notification.

---

# 10. Local Notifications

Use scheduled LOCAL notifications.

Do not depend on a remote push notification server.

When a task has a future due date/time, schedule a notification.

Example notification text:

`Task reminder: Submit mobile development assignment`

The exact wording may vary.

Required behavior:

## Task created with future due date

Schedule a notification.

## Task due date changed

Cancel the old notification and schedule a new one.

## Task due date removed

Cancel the existing notification.

## Task completed

Cancel its scheduled notification.

## Completed task changed back to pending

If its due date/time is still in the future, the notification may be scheduled again.

## Task deleted

Cancel its notification.

If useful, store a notification identifier associated with the task.

Document the strategy in `BUILD_LOG.md`.

---

# 11. Notification Permissions

If the operating system requires notification permission:

- request it appropriately;
- handle denial gracefully;
- do not crash if permission is denied.

Document permission-related decisions in `BUILD_LOG.md`.

---

# 12. Filtering

Support task filtering by:

## Status

- All
- Pending
- Completed

## Category

Allow selecting a category to display only tasks from that category.

You may implement filtering:

- in memory;
- through SQLite queries;
- through reactive database queries;
- using another reasonable approach.

Document the chosen approach in `BUILD_LOG.md`.

---

# 13. Error Handling

Handle common errors reasonably.

Examples:

- invalid title;
- SQLite errors;
- invalid dates;
- notification permission denial;
- notification scheduling errors.

The app should not crash unnecessarily.

Provide user feedback when appropriate.

---

# 14. UI Requirements

There is no mandatory visual design.

The UI should be:

- usable;
- understandable;
- reasonably consistent;
- suitable for a mobile device.

You may choose the visual style.

Avoid spending excessive effort on visual polish before the required functionality works.

---

# 15. Architecture

You may choose an appropriate architecture.

Possible examples include:

- MVVM;
- MVC;
- repository-based architecture;
- feature-based organization;
- Clean Architecture;
- framework-native conventions.

Do not introduce unnecessary complexity only for architectural purity.

Prefer a structure appropriate for a small educational application.

Document major architectural choices in `BUILD_LOG.md`.

---

# 16. State Management

Choose an appropriate state-management approach.

The application must correctly refresh the UI after actions such as:

- creating a task;
- editing a task;
- deleting a task;
- completing a task;
- changing a filter;
- modifying categories.

Document the selected state-management strategy in `BUILD_LOG.md`.

---

# 17. Dependencies

You may add dependencies when they are useful.

For every important dependency added, record in `BUILD_LOG.md`:

- dependency name;
- purpose;
- why it was selected.

Avoid adding unnecessary libraries.

---

# 18. Implementation Strategy

Work incrementally.

A suggested order is:

1. initialize project;
2. create `BUILD_LOG.md`;
3. create basic navigation;
4. define models;
5. configure SQLite;
6. implement task CRUD;
7. implement category CRUD;
8. connect UI to persistent data;
9. implement filtering;
10. implement due dates;
11. implement notifications;
12. handle permissions;
13. test persistence;
14. test notification behavior;
15. review and clean up the project.

You may change this order if appropriate.

If you do, document the reasoning.

---

# 19. Validation

Do not assume that generated code is correct.

Whenever possible:

- build the project;
- run it;
- inspect compiler output;
- test important user flows;
- fix errors found.

Record meaningful failures and fixes in `BUILD_LOG.md`.

---

# 20. Functional Acceptance Criteria

Before considering the project complete, verify:

- [ ] application builds successfully;
- [ ] application starts successfully;
- [ ] tasks can be created;
- [ ] tasks can be edited;
- [ ] tasks can be deleted;
- [ ] tasks can be marked completed;
- [ ] completed tasks can become pending again;
- [ ] tasks persist in SQLite;
- [ ] categories can be created;
- [ ] categories can be renamed;
- [ ] categories can be deleted;
- [ ] tasks can optionally belong to categories;
- [ ] status filtering works;
- [ ] category filtering works;
- [ ] navigation between required screens works;
- [ ] due dates can be assigned;
- [ ] local notifications can be scheduled;
- [ ] notifications are updated if due dates change;
- [ ] notifications are canceled when tasks are deleted;
- [ ] notifications are canceled when tasks are completed;
- [ ] notification permission is handled safely;
- [ ] data remains available after restarting the app;
- [ ] `BUILD_LOG.md` contains the development history.

---

# 21. Final Review

When the implementation appears complete:

1. review the acceptance criteria;
2. identify incomplete or partially working features;
3. test the most important application flows;
4. update `BUILD_LOG.md`;
5. provide a concise final summary containing:
   - architecture used;
   - important dependencies;
   - SQLite strategy;
   - state-management strategy;
   - navigation strategy;
   - notification strategy;
   - known limitations;
   - remaining bugs.

Do not remove or rewrite earlier `BUILD_LOG.md` entries.

---

# Important Instruction

Throughout this entire project:

**KEEP `BUILD_LOG.md` UPDATED.**

Whenever you make a meaningful decision, change, fix, or discover an error, append it to the log.

The development history is an essential part of the assignment, not optional documentation.