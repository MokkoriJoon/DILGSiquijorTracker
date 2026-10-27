export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD' | 'PUBLIC';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'OVERDUE';

export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'YEARLY';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string;
  position?: string;
  avatar?: string;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  recurrence: RecurrenceType;
  dueDay?: number; // For recurring tasks: day of month (1-31), stored in task_templates.due_day (INTEGER)
  dueDate?: string; // For ONCE (one-time) tasks: full chosen due date (YYYY-MM-DD), stored in task_templates.template_due_date (DATE)
  dueDaysOfWeek?: DayOfWeek[]; // For DAILY recurrence: which days of the week
  dueTime?: string; // For DAILY recurrence: time of day (HH:MM format)
  startDate?: string; // For DAILY recurrence: when the recurrence starts (YYYY-MM-DD format)
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resourceLink?: string;
  visible: boolean; // If false, only visible to assigned users
  createdBy: string;
  createdAt: string;
}

export interface TaskInstance {
  id: string;
  templateId: string;
  template: TaskTemplate;
  assignedTo: string;
  assignee: User;
  dueDate: string;
  status: TaskStatus;
  output?: string;
  completedAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  departments: DepartmentStats[];
}

export interface DepartmentStats {
  name: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}
