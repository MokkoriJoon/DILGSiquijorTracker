export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD' | 'PUBLIC';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'OVERDUE';

export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string;
  avatar?: string;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  recurrence: RecurrenceType;
  dueDay?: number;
  dueDaysOfWeek?: DayOfWeek[]; // For DAILY recurrence: which days of the week
  dueTime?: string; // For DAILY recurrence: time of day (HH:MM format)
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resourceLink?: string;
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
