import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  addCategory,
  addTask,
  deleteCategory,
  deleteTask,
  getCategories,
  getTasks,
  initializeDatabase,
  renameCategory,
  updateTask,
} from './src/db';
import {
  cancelTaskNotification,
  ensureNotificationPermission,
  scheduleTaskNotification,
} from './src/notifications';
import { Category, Task, TaskStatusFilter } from './src/types';

type RootStackParamList = {
  TaskList: undefined;
  TaskEditor: { taskId?: string };
  CategoryManagement: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No due date';
  }

  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return 'No due date';
  }
}

function formatDateTimeInput(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('Browser confirmation is unavailable.');
    }

    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const nextCategories = getCategories();
    const nextTasks = getTasks();
    setCategories(nextCategories);
    setTasks(nextTasks);
  }, []);

  useEffect(() => {
    initializeDatabase();
    void refreshData();
    void ensureNotificationPermission().catch(() => undefined);
  }, [refreshData]);

  const applyTaskNotificationLogic = useCallback(
    async (task: Task): Promise<Task> => {
      const existingTask = tasks.find((item) => item.id === task.id);
      const hasFutureDueDate = Boolean(task.dueDateTime && new Date(task.dueDateTime).getTime() > Date.now());

      if (existingTask?.notificationId) {
        await cancelTaskNotification(existingTask.notificationId);
      }

      if (task.completed || !hasFutureDueDate) {
        return {
          ...task,
          notificationId: null,
        };
      }

      const notificationId = await scheduleTaskNotification(task.title, task.dueDateTime as string);
      return {
        ...task,
        notificationId: notificationId ?? null,
      };
    },
    [tasks],
  );

  const handleSaveTask = useCallback(
    async (draftTask: Task): Promise<void> => {
      const normalizedTask: Task = {
        ...draftTask,
        title: draftTask.title.trim(),
        description: draftTask.description ?? '',
        categoryId: draftTask.categoryId ?? null,
        dueDateTime: draftTask.dueDateTime ?? null,
        completed: Boolean(draftTask.completed),
      };

      if (!normalizedTask.title) {
        Alert.alert('Validation', 'Task title is required.');
        return;
      }

      const storedTask = tasks.find((item) => item.id === normalizedTask.id);
      const nextWithNotification =
        Platform.OS === 'web'
          ? { ...normalizedTask, notificationId: null }
          : await applyTaskNotificationLogic(normalizedTask);
      const finalTask = { ...nextWithNotification };

      if (storedTask) {
        updateTask(finalTask);
      } else {
        addTask(finalTask);
      }

      await refreshData();
    },
    [applyTaskNotificationLogic, refreshData, tasks],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      const task = tasks.find((item) => item.id === taskId);

      if (task?.notificationId) {
        await cancelTaskNotification(task.notificationId);
      }

      deleteTask(taskId);
      await refreshData();
    },
    [refreshData, tasks],
  );

  const handleToggleTask = useCallback(
    async (taskId: string, completed: boolean): Promise<void> => {
      const task = tasks.find((item) => item.id === taskId);

      if (!task) {
        return;
      }

      const updatedTask: Task = {
        ...task,
        completed,
      };

      if (completed && task.notificationId) {
        await cancelTaskNotification(task.notificationId);
        updatedTask.notificationId = null;
      }

      if (!completed && task.dueDateTime && new Date(task.dueDateTime).getTime() > Date.now()) {
        const notificationId = await scheduleTaskNotification(task.title, task.dueDateTime);
        updatedTask.notificationId = notificationId ?? null;
      } else if (!completed) {
        updatedTask.notificationId = null;
      }

      updateTask(updatedTask);
      await refreshData();
    },
    [refreshData, tasks],
  );

  const handleCreateCategory = useCallback(
    async (name: string): Promise<void> => {
      const normalizedName = name.trim();

      if (!normalizedName) {
        Alert.alert('Validation', 'Category name cannot be empty.');
        return;
      }

      addCategory(normalizedName);
      await refreshData();
    },
    [refreshData],
  );

  const handleRenameCategory = useCallback(
    async (categoryId: string, name: string): Promise<void> => {
      const normalizedName = name.trim();

      if (!normalizedName) {
        Alert.alert('Validation', 'Category name cannot be empty.');
        return;
      }

      renameCategory(categoryId, normalizedName);
      await refreshData();
    },
    [refreshData],
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string): Promise<void> => {
      const confirmed = await confirmAction(
        'Delete category',
        'Tasks from this category will become uncategorized.',
      );

      if (!confirmed) {
        return;
      }

      deleteCategory(categoryId);
      setCategoryFilter((currentFilter) => (currentFilter === categoryId ? null : currentFilter));
      await refreshData();
    },
    [refreshData],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'pending' && !task.completed) ||
          (statusFilter === 'completed' && task.completed);

        const matchesCategory = !categoryFilter || task.categoryId === categoryFilter;
        return matchesStatus && matchesCategory;
      }),
    [categoryFilter, statusFilter, tasks],
  );

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="TaskList">
        <Stack.Screen name="TaskList" options={{ title: 'Tasks' }}>
          {(props) => (
            <TaskListScreen
              {...props}
              categories={categories}
              tasks={filteredTasks}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              onSetStatusFilter={setStatusFilter}
              onSetCategoryFilter={setCategoryFilter}
              onToggleTask={handleToggleTask}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TaskEditor" options={{ title: 'Task detail' }}>
          {(props) => (
            <TaskEditorScreen
              {...props}
              categories={categories}
              tasks={tasks}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="CategoryManagement" options={{ title: 'Categories' }}>
          {(props) => (
            <CategoryManagementScreen
              {...props}
              categories={categories}
              onCreateCategory={handleCreateCategory}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function TaskListScreen({
  navigation,
  tasks,
  categories,
  statusFilter,
  categoryFilter,
  onSetStatusFilter,
  onSetCategoryFilter,
  onToggleTask,
}: {
  navigation: any;
  tasks: Task[];
  categories: Category[];
  statusFilter: TaskStatusFilter;
  categoryFilter: string | null;
  onSetStatusFilter: (value: TaskStatusFilter) => void;
  onSetCategoryFilter: (value: string | null) => void;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
}) {
  return (
    <View style={styles.screenShell}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TaskEditor', {})}>
          <Text style={styles.primaryButtonText}>+ New task</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CategoryManagement')}>
          <Text style={styles.secondaryButtonText}>Categories</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Status</Text>
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as TaskStatusFilter[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => onSetStatusFilter(filter)}
          >
            <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
              {filter === 'all' ? 'All' : filter === 'pending' ? 'Pending' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryFilters}>
        <TouchableOpacity
          style={[styles.filterChip, categoryFilter === null && styles.filterChipActive]}
          onPress={() => onSetCategoryFilter(null)}
        >
          <Text style={[styles.filterChipText, categoryFilter === null && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.filterChip, categoryFilter === category.id && styles.filterChipActive]}
            onPress={() => onSetCategoryFilter(category.id)}
          >
            <Text style={[styles.filterChipText, categoryFilter === category.id && styles.filterChipTextActive]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks for this filter.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('TaskEditor', { taskId: item.id })}>
            <View style={[styles.taskCard, item.completed && styles.taskCardCompleted]}>
              <View style={styles.taskHeaderRow}>
                <Text style={[styles.taskTitle, item.completed && styles.taskTitleCompleted]}>{item.title}</Text>
                <Switch value={item.completed} onValueChange={(value) => onToggleTask(item.id, value)} />
              </View>

              <Text style={styles.taskMeta}>{item.categoryName ?? 'Uncategorized'}</Text>
              {item.description ? <Text style={styles.taskMeta}>{item.description}</Text> : null}
              <Text style={styles.taskMeta}>{formatDateTime(item.dueDateTime)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function TaskEditorScreen({
  navigation,
  route,
  categories,
  tasks,
  onSaveTask,
  onDeleteTask,
}: {
  navigation: any;
  route: any;
  categories: Category[];
  tasks: Task[];
  onSaveTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}) {
  const taskId = route.params?.taskId;
  const existingTask = tasks.find((task) => task.id === taskId) ?? null;

  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [description, setDescription] = useState(existingTask?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existingTask?.categoryId ?? null);
  const [completed, setCompleted] = useState(Boolean(existingTask?.completed));
  const [dueDateTime, setDueDateTime] = useState<string | null>(existingTask?.dueDateTime ?? null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  useEffect(() => {
    setTitle(existingTask?.title ?? '');
    setDescription(existingTask?.description ?? '');
    setCategoryId(existingTask?.categoryId ?? null);
    setCompleted(Boolean(existingTask?.completed));
    setDueDateTime(existingTask?.dueDateTime ?? null);
  }, [existingTask]);

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;

  const openDateTimePicker = () => {
    const storedDate = dueDateTime ? new Date(dueDateTime) : new Date();
    const initialDate = Number.isNaN(storedDate.getTime()) ? new Date() : storedDate;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        onValueChange: (_event, selectedDate) => {
          const selectedDay = new Date(initialDate);
          selectedDay.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

          DateTimePickerAndroid.open({
            value: selectedDay,
            mode: 'time',
            is24Hour: true,
            onValueChange: (_timeEvent, selectedTime) => {
              selectedDay.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              setDueDateTime(selectedDay.toISOString());
            },
          });
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'A task title is required.');
      return;
    }

    const payload: Task = {
      id: existingTask?.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      description,
      completed,
      dueDateTime,
      createdAt: existingTask?.createdAt ?? new Date().toISOString(),
      categoryId,
      notificationId: existingTask?.notificationId ?? null,
    };

    await onSaveTask(payload);
    navigation.goBack();
  };

  const onDelete = async () => {
    if (!existingTask) {
      navigation.goBack();
      return;
    }

    const confirmed = await confirmAction('Delete task', 'This task will be permanently removed.');

    if (!confirmed) {
      return;
    }

    await onDeleteTask(existingTask.id);
    navigation.goBack();
  };

  return (
    <View style={styles.screenShell}>
      <Text style={styles.sectionTitle}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Task title" style={styles.input} />

      <Text style={styles.sectionTitle}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description"
        multiline
        style={[styles.input, styles.textArea]}
      />

      <Text style={styles.sectionTitle}>Due date and time</Text>
      {Platform.OS === 'web' ? (
        <View style={styles.selectionBox}>
          {React.createElement('input', {
            type: 'datetime-local',
            value: formatDateTimeInput(dueDateTime),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!event.currentTarget.value) {
                setDueDateTime(null);
                return;
              }

              const selectedDate = new Date(event.currentTarget.value);
              if (!Number.isNaN(selectedDate.getTime())) {
                setDueDateTime(selectedDate.toISOString());
              }
            },
            'aria-label': 'Due date and time',
            style: {
              width: '100%',
              height: 44,
              boxSizing: 'border-box',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#111827',
              fontSize: 16,
            },
          })}
        </View>
      ) : (
        <TouchableOpacity style={styles.selectionBox} onPress={openDateTimePicker}>
          <Text>{dueDateTime ? formatDateTime(dueDateTime) : 'Select due date and time'}</Text>
        </TouchableOpacity>
      )}

      {showDatePicker && Platform.OS === 'ios' && (
        <DateTimePicker
          value={dueDateTime ? new Date(dueDateTime) : new Date()}
          mode="datetime"
          display="spinner"
          onValueChange={(_event, selectedDate) => {
            setDueDateTime(selectedDate.toISOString());
            setShowDatePicker(false);
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      <Text style={styles.sectionTitle}>Category</Text>
      <TouchableOpacity style={styles.selectionBox} onPress={() => setCategoryPickerVisible(true)}>
        <Text>{selectedCategory ? selectedCategory.name : 'No category'}</Text>
      </TouchableOpacity>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Completed</Text>
        <Switch value={completed} onValueChange={setCompleted} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={onSave}>
          <Text style={styles.primaryButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {existingTask ? (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </TouchableOpacity>
      ) : null}

      <Modal transparent visible={categoryPickerVisible} animationType="slide" onRequestClose={() => setCategoryPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select category</Text>

            <TouchableOpacity style={styles.modalOption} onPress={() => { setCategoryId(null); setCategoryPickerVisible(false); }}>
              <Text>Uncategorized</Text>
            </TouchableOpacity>

            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.modalOption}
                onPress={() => {
                  setCategoryId(category.id);
                  setCategoryPickerVisible(false);
                }}
              >
                <Text>{category.name}</Text>
              </TouchableOpacity>
            ))}

            <Pressable onPress={() => setCategoryPickerVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CategoryManagementScreen({
  navigation,
  categories,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: {
  navigation: any;
  categories: Category[];
  onCreateCategory: (name: string) => Promise<void>;
  onRenameCategory: (categoryId: string, name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  return (
    <View style={styles.screenShell}>
      <Text style={styles.sectionTitle}>Create category</Text>
      <View style={styles.inlineRow}>
        <TextInput
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="Category name"
          style={[styles.input, styles.flexInput]}
        />
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            await onCreateCategory(newCategoryName);
            setNewCategoryName('');
          }}
        >
          <Text style={styles.primaryButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Categories</Text>
      {categories.length === 0 ? <Text style={styles.emptyText}>No categories yet.</Text> : null}

      {categories.map((category) => (
        <View key={category.id} style={styles.categoryRow}>
          {editingCategoryId === category.id ? (
            <View style={styles.inlineRow}>
              <TextInput
                value={editingValue}
                onChangeText={setEditingValue}
                style={[styles.input, styles.flexInput]}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  await onRenameCategory(category.id, editingValue);
                  setEditingCategoryId(null);
                }}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rowBetween}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <View style={styles.inlineActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setEditingCategoryId(category.id);
                    setEditingValue(category.name);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButtonSmall}
                  onPress={() => onDeleteCategory(category.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    padding: 16,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#dde8ff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonText: {
    color: '#12397d',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f2937',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryFilters: {
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1f6feb',
  },
  filterChipText: {
    color: '#374151',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  taskCardCompleted: {
    opacity: 0.75,
    backgroundColor: '#eef7f1',
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
    marginRight: 12,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    color: '#4b5563',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e1ee',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectionBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e1ee',
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonSmall: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  flexInput: {
    flex: 1,
  },
  categoryRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontWeight: '600',
    color: '#1f6feb',
  },
});

export default App;
