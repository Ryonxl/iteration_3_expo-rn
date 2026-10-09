# Mobile App Reverse-Engineering Questions

## 1. Project Structure

This repository is a small Expo + React Native task manager built in TypeScript. The root entry point is `index.ts`, which calls `registerRootComponent(App)` and loads the app from `App.tsx`. The app is intentionally compact: the screen logic and the navigation stack live in `App.tsx`, while the data layer and notification logic are separated into `src/db.ts` and `src/notifications.ts`.

- `App.tsx`: contains the root `App` component, the three screen components (`TaskListScreen`, `TaskEditorScreen`, `CategoryManagementScreen`), the navigation stack, and most of the UI styling.
- `src/types.ts`: defines the business objects `Task`, `Category`, `NewTaskInput`, and the status filter union `TaskStatusFilter`.
- `src/db.ts`: implements persistence for tasks and categories, with platform-specific logic for native SQLite and the browser `localStorage` fallback.
- `src/notifications.ts`: encapsulates permission checks, reminder scheduling, and notification cancellation.
- `BUILD_LOG.md`: records the implementation history, environment constraints, and fixes attempted during development.
- `package.json` / `app.json` / `metro.config.js`: define the Expo SDK version, web support, and the Metro configuration for the project.

The overall architecture is a simple layered app: React UI state in `App.tsx`, persistence in `src/db.ts`, and reminder behavior in `src/notifications.ts`. There is no backend service or external API, and no dedicated global state management library such as Redux or Zustand.

## 2. Architecture and State

The state is managed with React hooks instead of a dedicated store. In `App.tsx`, the root component declares `categories`, `tasks`, `statusFilter`, and `categoryFilter` via `useState()`. The app also uses `useMemo()` to compute filtered tasks and `useCallback()` to guarantee stable handlers for mutations and refresh logic.

When the app loads, the `useEffect()` hook in `App` executes `initializeDatabase()` and then calls `refreshData()`. `refreshData()` reads `getCategories()` and `getTasks()` from `src/db.ts` and updates the component state with `setCategories()` and `setTasks()`. This pattern means the UI is refreshed by re-reading storage after each mutation instead of synchronizing a separate central state store.

The main task operations are implemented directly in `App.tsx`:

- `handleSaveTask()`: validates input, normalizes the task object, calls the reminder logic, and then either inserts or updates the record through `addTask()` / `updateTask()`.
- `handleToggleTask()`: changes the task's `completed` flag, cancels the reminder when marking complete, or reschedules it when reopening a task with a future due date.
- `handleDeleteTask()`: cancels the scheduled reminder if one exists, removes the task record, and refreshes the UI.
- `handleCreateCategory()`, `handleRenameCategory()`, and `handleDeleteCategory()`: manage category changes and call `refreshData()` afterward.

The UI is therefore reactive to local state, but the authoritative data originates from the persistence layer. The code is a lightweight, component-driven architecture rather than a formal MVVM or clean-architecture implementation.

## 3. Persistence and Data Model

The data model is declared in `src/types.ts`:

- `Category`: `{ id: string; name: string }`
- `Task`: `{ id, title, description, completed, dueDateTime, createdAt, categoryId, notificationId?, categoryName? }`
- `TaskStatusFilter`: `'all' | 'pending' | 'completed'`
- `NewTaskInput`: a task payload that may omit `id`, `createdAt`, or `categoryName`

The database logic is in `src/db.ts`. On native platforms, it uses `expo-sqlite` and creates a synchronous database connection via `SQLite.openDatabaseSync('task_manager.db')`. The `initializeDatabase()` function creates two tables:

- `categories(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE)`
- `tasks(id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, completed INTEGER NOT NULL DEFAULT 0, dueDateTime TEXT, createdAt TEXT NOT NULL, categoryId TEXT, notificationId TEXT, FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL)`

The actual operations are:

- `addCategory()` and `addTask()` insert rows.
- `getCategories()` and `getTasks()` read rows; `getTasks()` also joins the category name through `LEFT JOIN categories c ON c.id = t.categoryId`.
- `renameCategory()` and `updateTask()` update rows.
- `deleteTask()` removes a task and `deleteCategory()` first clears the `categoryId` on affected tasks before deleting the category.

This design is compatible with the app requirement that tasks can exist without a category. The foreign key is configured with `ON DELETE SET NULL`, so when a category is deleted, tasks keep their identity and become effectively uncategorized.

A platform difference is explicit in the same file: when `Platform.OS === 'web'`, the app does not open SQLite. Instead, it uses browser `localStorage` with `todo_categories_v1` and `todo_tasks_v1` as the backing store. This difference is also reflected in `app.json` and `metro.config.js`, which add web support for Expo and configure the Metro resolver to include `.wasm` files.

After the latest fixes, task deletion, category deletion, and task-category association were corrected. The app allows users to delete tasks and categories and displays the selected category for each task. These changes were made without changing the overall data model or the platform-specific storage approach.

## 4. Follow One Full Operation: Create and Save a Task

The end-to-end task creation flow is implemented in `App.tsx` and `src/db.ts`.

1. The user opens the `TaskEditorScreen` from `TaskListScreen` by pressing the New task button or by tapping an existing task.
2. The editor initializes local React state such as `title`, `description`, `categoryId`, `completed`, and `dueDateTime` from the selected task, or empty values for a new task.
3. When the user presses Save, the `onSave` callback in `TaskEditorScreen` creates a `Task` payload using either the existing task's `id`/`createdAt` or a new generated value such as `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.
4. The app then calls `onSaveTask(payload)`, which resolves to `handleSaveTask()` in the root `App` component.
5. `handleSaveTask()` normalizes the payload (`trim()`, `description ?? ''`, `categoryId ?? null`, `completed: Boolean(...)`) and rejects empty titles with `Alert.alert('Validation', 'Task title is required.')`.
6. Before saving, it calls `applyTaskNotificationLogic(normalizedTask)`. That helper checks `tasks.find((item) => item.id === task.id)` to detect an existing reminder, cancels it if needed, and then schedules a new reminder only if the task is not completed and `dueDateTime` is in the future.
7. The final task object is persisted through either `updateTask(finalTask)` or `addTask(finalTask)`. In native mode this writes to SQLite; in web mode it writes to `localStorage`.
8. After persistence, the app calls `await refreshData()`, which reloads tasks and categories from storage and re-renders the list.
9. Finally, `navigation.goBack()` returns the user to the list screen.

This is the real execution path; there is no hidden service or asynchronous queue beyond the local operations in the app itself. The reminder ID is stored inside the task record as `notificationId`, which allows future cancellations and rescheduling.

The task creation and editing flow was updated to support selecting and saving a due date and time, preserving the task status, and associating a task with its selected category. The task deletion option was also restored in the user interface. These changes address the issues identified during development while preserving the existing navigation and persistence architecture.

## 5. Navigation and Screen Behavior

Navigation is implemented in `App.tsx` with `NavigationContainer` and `createNativeStackNavigator<RootStackParamList>()`. The defined routes are:

- `TaskList` (undefined params)
- `TaskEditor` (`{ taskId?: string }`)
- `CategoryManagement` (undefined params)

The navigation flow is straightforward:

- From `TaskListScreen`, pressing the New task button navigates to `TaskEditor` with no parameters, and tapping an existing task passes `{ taskId: item.id }`.
- The Categories button navigates to `CategoryManagement`.
- In `TaskEditorScreen`, the `route.params?.taskId` value is used to determine whether the user is editing an existing task or creating a new one.
- The screen uses `useEffect()` to synchronize the local form state with the selected task when `existingTask` changes.

The task list screen also supports filtering by status and category. The root `App` maintains `statusFilter` and `categoryFilter` and passes them as props into `TaskListScreen`. The list is derived from `tasks.filter(...)` using `useMemo()` so that the list is recalculated when either the filter or the task collection changes.

## 6. Notifications: Implemented Behavior and Honest Limitations

Notification logic is in `src/notifications.ts` and is wrapped by the `expo-notifications` API.

- `Notifications.setNotificationHandler({...})` configures the default behavior for incoming local notifications: `shouldShowAlert`, `shouldPlaySound`, `shouldShowBanner`, and `shouldShowList` are all enabled, while badge updates are disabled.
- `ensureNotificationPermission()` checks `Notifications.getPermissionsAsync()` and calls `Notifications.requestPermissionsAsync()` if needed.
- `scheduleTaskNotification(taskTitle, dueDateTime)` verifies that the date is valid, in the future, and that permission has been granted before calling `Notifications.scheduleNotificationAsync()`. The trigger is `Notifications.SchedulableTriggerInputTypes.DATE`, and the payload contains a title of `Task reminder` with a body like `Task reminder: ${taskTitle}`.
- `cancelTaskNotification(notificationId)` invokes `Notifications.cancelScheduledNotificationAsync(notificationId)` when a valid notification ID exists.

The app-level logic in `App.tsx` is responsible for deciding when to schedule or cancel reminders:

- `applyTaskNotificationLogic()` cancels the old notification if one exists before considering a new one.
- It does not schedule anything if the task is marked complete or the deadline is not in the future.
- `handleToggleTask()` cancels the reminder whenever the task becomes complete and re-schedules it only when a task is reopened and still has a valid future due date.
- `handleDeleteTask()` cancels scheduled reminders before deleting the task.
- `TaskEditorScreen` also allows the user to set a due date and time using `@react-native-community/datetimepicker`.

The main difficulty encountered during the project was implementing the local notification feature. Although the notification logic was implemented using Expo Notifications, the feature did not work as expected during development. The code includes permission requests, notification scheduling, cancellation, and rescheduling when tasks are modified, completed, or reopened. However, these operations did not result in the expected notification behavior.

This issue remained unresolved and became one of the main limitations of the application. Further debugging and testing would be necessary to identify the exact cause of the failure and ensure that reminders are triggered correctly when tasks reach their due dates. The project also lacks documented evidence of successful end-to-end notification tests on a physical device. Therefore, the notification feature should be described as implemented but not functioning as expected, rather than as a fully completed feature. Web notification behavior was also not confirmed.

## 7. Agent Decisions and Development History

The build log and code together indicate some project decisions that were not strictly forced by the assignment:

1. The project uses `@react-navigation/native` and `@react-navigation/native-stack` rather than a simpler manual screen swap. This is recorded as a deliberate architectural choice to handle the three-screen flow (`TaskList`, `TaskEditor`, and `CategoryManagement`).
2. The project uses React's built-in hooks rather than a more formal state management layer. The developer intentionally kept `tasks` and `categories` in local component state and refreshed them from persistence after each mutation.
3. The project uses `expo-sqlite` on native platforms and a browser `localStorage` fallback on web. This was not just a random implementation detail: it was an explicit decision made to keep the app working in the available environment and to support web execution when Android tooling was not available.
4. The application stores `notificationId` inside each task record so reminders can be canceled or replaced in a lightweight way without a separate notification table.

The `BUILD_LOG.md` is useful because it records the sequence of implementation and environmental constraints. It states that the project was created as an Expo app compatible with Expo Go, then later moved to a web-first execution path because Android SDK/ADB was unavailable in the WSL environment. It also notes earlier problems with missing `react-dom` and `react-native-web` dependencies and the need to configure `meta`/web bundling for SQLite/WASM compatibility.

There is no evidence in the repo of a separate AI-agent memory or hidden prompt history beyond what is captured in the build log. The code and the log together are the reliable source for project decisions.

## 8. BUILD_LOG Analysis

The project history is important because the final code alone does not explain all the changes. `BUILD_LOG.md` shows that the app initially failed in web mode because `react-dom` and `react-native-web` were missing, and later the project was re-configured to support web execution in WSL where Android tools were unavailable.

The log records these steps explicitly:

- The app was created as an Expo project compatible with Expo Go.
- Web execution problems were encountered because `react-dom` and `react-native-web` were missing.
- The project later adjusted `package.json`, `app.json`, and `metro.config.js` to support web execution and `.wasm` files.
- The `src/db.ts` layer was split by runtime so web uses `localStorage` while native uses SQLite.
- Notification-related API changes were also recorded, including the adjustment to `NotificationHandler` and use of `SchedulableTriggerInputTypes.DATE`.

The build log therefore documents not only the final implementation but the reasoning behind it. The repository does not provide a complete automated end-to-end test suite or a device-level verification log, so the build log should be read as a historical record of implementation decisions and known issues, not as independent proof of full feature success.

This caveat is especially relevant for notifications: the code clearly implements reminder logic and the project history records steps taken to make that code compile, but the repo does not demonstrate a successful notification test on a real device. The honest conclusion is that the feature was implemented according to the app design, but its real-world runtime behavior was not fully verified from this codebase alone.
