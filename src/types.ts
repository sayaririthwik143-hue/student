export interface PriorityLevel {
  id: string;
  label: string;
  color: string; // Tailwind color class like 'bg-red-500'
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  disciplineScore: number;
  studyGoal: string;
  dailyTargetMinutes: number;
  badges: string[];
  createdAt: string;
  customPriorities?: PriorityLevel[];
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  category: 'Homework' | 'Assignment' | 'Study' | 'Project' | 'Revision';
  priority: string;
  startDate: string;
  endDate: string;
  completed: boolean;
  createdAt: string;
  penaltyApplied?: boolean;
  penaltyExpiresAt?: string;
  reminderTime?: string | null;
  reminderTriggered?: boolean;
}

export interface StudySession {
  id: string;
  userId: string;
  subject: string;
  durationMinutes: number;
  mode: 'Deep Study' | 'Revision' | 'Quick Practice';
  timestamp: string;
}

export interface AppUsage {
  appName: string;
  minutesUsed: number;
  isProductive: boolean;
}
