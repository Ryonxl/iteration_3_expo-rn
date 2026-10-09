import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { Category, NewTaskInput, Task } from './types';

const isWebRuntime = Platform.OS === 'web';
const STORAGE_KEYS = {
  categories: 'todo_categories_v1',
  tasks: 'todo_tasks_v1',
};

const db = isWebRuntime ? null : SQLite.openDatabaseSync('task_manager.db');

function readWebStorage<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeWebStorage<T>(key: string, value: T[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

function mapTaskRow(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    completed: Boolean(row.completed),
    dueDateTime: row.dueDateTime ?? null,
    createdAt: row.createdAt,
    categoryId: row.categoryId ?? null,
    notificationId: row.notificationId ?? null,
    categoryName: row.categoryName ?? null,
  };
}

export function initializeDatabase(): void {
  if (isWebRuntime) {
    if (!readWebStorage<Category>(STORAGE_KEYS.categories, []).length) {
      writeWebStorage(STORAGE_KEYS.categories, []);
    }

    if (!readWebStorage<Task>(STORAGE_KEYS.tasks, []).length) {
      writeWebStorage(STORAGE_KEYS.tasks, []);
    }
    return;
  }

  db?.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      dueDateTime TEXT,
      createdAt TEXT NOT NULL,
      categoryId TEXT,
      notificationId TEXT,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);
}

export function getCategories(): Category[] {
  if (isWebRuntime) {
    return readWebStorage<Category>(STORAGE_KEYS.categories, []);
  }

  return db?.getAllSync('SELECT * FROM categories ORDER BY name COLLATE NOCASE ASC') as Category[];
}

export function getTasks(): Task[] {
  if (isWebRuntime) {
    const categories = getCategories();
    return readWebStorage<Task>(STORAGE_KEYS.tasks, []).map((task) => ({
      ...task,
      categoryName: categories.find((category) => category.id === task.categoryId)?.name ?? null,
    }));
  }

  const rows = db?.getAllSync(
    `
      SELECT t.*, c.name AS categoryName
      FROM tasks t
      LEFT JOIN categories c ON c.id = t.categoryId
      ORDER BY t.createdAt DESC
    `,
  ) as any[];

  return rows.map(mapTaskRow);
}

export function addCategory(name: string): Category {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Category name cannot be empty.');
  }

  const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const category = { id, name: trimmedName };

  if (isWebRuntime) {
    const categories = getCategories();
    const nextCategories = [...categories, category];
    writeWebStorage(STORAGE_KEYS.categories, nextCategories);
    return category;
  }

  db?.runSync('INSERT INTO categories (id, name) VALUES (?, ?)', [id, trimmedName]);

  return category;
}

export function renameCategory(id: string, newName: string): Category {
  const trimmedName = newName.trim();

  if (!trimmedName) {
    throw new Error('Category name cannot be empty.');
  }

  if (isWebRuntime) {
    const categories = getCategories().map((category) => (category.id === id ? { ...category, name: trimmedName } : category));
    writeWebStorage(STORAGE_KEYS.categories, categories);
    return { id, name: trimmedName };
  }

  db?.runSync('UPDATE categories SET name = ? WHERE id = ?', [trimmedName, id]);

  return { id, name: trimmedName };
}

export function deleteCategory(categoryId: string): void {
  if (isWebRuntime) {
    const tasks = getTasks().map((task) =>
      task.categoryId === categoryId ? { ...task, categoryId: null, categoryName: null } : task,
    );
    const categories = getCategories().filter((category) => category.id !== categoryId);
    writeWebStorage(STORAGE_KEYS.tasks, tasks);
    writeWebStorage(STORAGE_KEYS.categories, categories);
    return;
  }

  db?.runSync('UPDATE tasks SET categoryId = NULL WHERE categoryId = ?', [categoryId]);
  db?.runSync('DELETE FROM categories WHERE id = ?', [categoryId]);
}

export function addTask(task: NewTaskInput): Task {
  const id = task.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedTask: Task = {
    id,
    title: task.title.trim(),
    description: task.description ?? '',
    completed: Boolean(task.completed),
    dueDateTime: task.dueDateTime ?? null,
    createdAt: task.createdAt ?? new Date().toISOString(),
    categoryId: task.categoryId ?? null,
    notificationId: task.notificationId ?? null,
    categoryName: task.categoryName ?? null,
  };

  if (isWebRuntime) {
    const tasks = [...getTasks(), normalizedTask];
    writeWebStorage(STORAGE_KEYS.tasks, tasks);
    return normalizedTask;
  }

  db?.runSync(
    `
      INSERT INTO tasks (id, title, description, completed, dueDateTime, createdAt, categoryId, notificationId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      normalizedTask.id,
      normalizedTask.title,
      normalizedTask.description,
      normalizedTask.completed ? 1 : 0,
      normalizedTask.dueDateTime,
      normalizedTask.createdAt,
      normalizedTask.categoryId,
      normalizedTask.notificationId ?? null,
    ],
  );

  return normalizedTask;
}

export function updateTask(task: Task): Task {
  const normalizedTask: Task = {
    ...task,
    title: task.title.trim(),
    description: task.description ?? '',
    completed: Boolean(task.completed),
    dueDateTime: task.dueDateTime ?? null,
    notificationId: task.notificationId ?? null,
  };

  if (isWebRuntime) {
    const tasks = getTasks().map((item) => (item.id === normalizedTask.id ? normalizedTask : item));
    writeWebStorage(STORAGE_KEYS.tasks, tasks);
    return normalizedTask;
  }

  db?.runSync(
    `
      UPDATE tasks
      SET title = ?, description = ?, completed = ?, dueDateTime = ?, categoryId = ?, notificationId = ?
      WHERE id = ?
    `,
    [
      normalizedTask.title,
      normalizedTask.description,
      normalizedTask.completed ? 1 : 0,
      normalizedTask.dueDateTime,
      normalizedTask.categoryId,
      normalizedTask.notificationId ?? null,
      normalizedTask.id,
    ],
  );

  return normalizedTask;
}

export function deleteTask(taskId: string): void {
  if (isWebRuntime) {
    const tasks = getTasks().filter((task) => task.id !== taskId);
    writeWebStorage(STORAGE_KEYS.tasks, tasks);
    return;
  }

  db?.runSync('DELETE FROM tasks WHERE id = ?', [taskId]);
}

export function toggleTaskCompletion(taskId: string, completed: boolean): Task | null {
  const existing = getTasks().find((task) => task.id === taskId);

  if (!existing) {
    return null;
  }

  const nextTask: Task = { ...existing, completed };
  updateTask(nextTask);
  return nextTask;
}
