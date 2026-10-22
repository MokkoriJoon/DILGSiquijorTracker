/**
 * Clean system - no pre-seeded data
 * All data starts empty and is created through user actions
 */

import { User, TaskTemplate, TaskInstance } from '../types';

// Empty initial state - clean system
export const mockUsers: User[] = [];
export const mockTaskTemplates: TaskTemplate[] = [];
export const mockTaskInstances: TaskInstance[] = [];

// Siquijor Province departments/municipalities
export const DEPARTMENTS = [
  'DILG Siquijor Provincial Office',
  'Municipality of Siquijor',
  'Municipality of Larena',
  'Municipality of San Juan',
  'Municipality of Enrique Villanueva',
  'Municipality of Maria',
  'Municipality of Lazi',
] as const;

export type Department = typeof DEPARTMENTS[number];

// Task categories relevant to DILG Siquijor
export const TASK_CATEGORIES = [
  'Reporting',
  'LGU Compliance',
  'Barangay Governance',
  'Peace & Order',
  'Disaster Preparedness',
  'Capacity Building',
  'Finance & Budget',
  'Administration',
  'Field Operations',
  'Performance Review',
] as const;
