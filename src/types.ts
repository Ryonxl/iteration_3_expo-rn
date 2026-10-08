export type Category = {
  id: string;
  name: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  dueDateTime: string | null;
  createdAt: string;
  categoryId: string | null;
  notificationId?: string | null;
  categoryName?: string | null;
};

export type TaskStatusFilter = 'all' | 'pending' | 'completed';

export type NewTaskInput = Omit<Task, 'id' | 'createdAt' | 'categoryName'> & {
  id?: string;
  createdAt?: string;
  categoryId?: string | null;
  categoryName?: string | null;
};
