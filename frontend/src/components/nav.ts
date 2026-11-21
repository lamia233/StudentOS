import { BarChart3, Bell, BookOpen, Bot, BrainCircuit, Briefcase, CalendarDays, CheckSquare, GraduationCap, LayoutDashboard, Library, Radar, Settings, Sparkles, Timer, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Today',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/radar', label: 'Deadline Radar', icon: Radar },
      { to: '/app/focus', label: 'Focus Mode', icon: Timer },
      { to: '/app/assistant', label: 'Assistant', icon: Bot },
    ],
  },
  {
    label: 'Academics',
    items: [
      { to: '/app/academics', label: 'Courses & Exams', icon: GraduationCap },
      { to: '/app/planner', label: 'Study Planner', icon: Sparkles },
      { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/app/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/app/knowledge', label: 'Knowledge Hub', icon: Library },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/app/career', label: 'Career', icon: Briefcase },
      { to: '/app/skills', label: 'Skills', icon: BrainCircuit },
      { to: '/app/campus', label: 'Campus Life', icon: Users },
      { to: '/app/productivity', label: 'Productivity', icon: BarChart3 },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/app/notion', label: 'Notion', icon: BookOpen },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = [
  { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/app/planner', label: 'Plan', icon: Sparkles },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
];

export { Bell };
