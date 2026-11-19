import raw from "../data/projects.json";

export type ProjectStatus = "On Track" | "At Risk" | "Delayed" | "Completed" | "On Hold";

export interface Milestone {
  name: string;
  planned: string;
  forecast: string;
  actual: string | null;
}

export interface Risk {
  title: string;
  severity: "High" | "Medium" | "Low";
}

export interface Project {
  id: string;
  name: string;
  type: string;
  client: string;
  city: string;
  state: string;
  status: ProjectStatus;
  contractValue: number;
  costToDate: number;
  percentComplete: number;
  startDate: string;
  plannedCompletion: string;
  forecastCompletion: string;
  actualCompletion: string | null;
  projectManager: string;
  generalContractor: string;
  liquidatedDamagesPerDay: number;
  contractDocument: string;
  description: string;
  milestones: Milestone[];
  risks: Risk[];
}

export const AS_OF_DATE: string = raw.asOfDate;
export const PROJECTS: Project[] = raw.projects as Project[];
export const PROJECT_STATUSES: ProjectStatus[] = ["On Track", "At Risk", "Delayed", "Completed", "On Hold"];

const DAY_MS = 86_400_000;

export function parseDate(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Invalid date "${iso}" (expected YYYY-MM-DD)`);
  const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso) throw new Error(`Invalid date "${iso}"`);
  return t;
}

/** Calendar days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

export function findProject(id: string): Project | undefined {
  const norm = normalizeProjectId(id);
  return PROJECTS.find((p) => p.id === norm);
}

export function normalizeProjectId(id: string): string {
  const m = /^\s*bm[-\s]?(\d{3})\s*$/i.exec(id);
  return m ? `BM-${m[1]}` : id.trim().toUpperCase();
}

export interface MilestoneDelay {
  name: string;
  planned: string;
  date: string; // actual if finished, otherwise forecast
  finished: boolean;
  delayDays: number;
}

export interface DelayAnalysis {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  asOfDate: string;
  plannedCompletion: string;
  completionDate: string;
  completionBasis: "actual" | "forecast";
  delayDays: number; // > 0 late, 0 on time, < 0 early
  isDelayed: boolean;
  baselineDurationDays: number;
  timeElapsedPercent: number;
  percentComplete: number;
  progressGapPoints: number; // percentComplete − timeElapsedPercent
  milestones: MilestoneDelay[];
  worstMilestone: MilestoneDelay | null;
  liquidatedDamagesPerDay: number;
  liquidatedDamagesExposure: number; // delayDays × LD rate (before cap)
  liquidatedDamagesCap: number; // 10% of contract value (BM-GC-2024 §9.2)
  liquidatedDamagesExposureCapped: number;
  recoveryScheduleRequired: boolean; // > 14 days (BM-GC-2024 §8.3)
}

/** Deterministic schedule-delay calculation used by both the dashboard and the agent tools. */
export function computeDelay(project: Project, asOfDate: string = AS_OF_DATE): DelayAnalysis {
  parseDate(asOfDate);
  const completionBasis = project.actualCompletion ? "actual" : "forecast";
  const completionDate = project.actualCompletion ?? project.forecastCompletion;
  const delayDays = daysBetween(project.plannedCompletion, completionDate);
  const baselineDurationDays = daysBetween(project.startDate, project.plannedCompletion);
  const elapsed = Math.min(Math.max(daysBetween(project.startDate, asOfDate), 0), baselineDurationDays);
  const timeElapsedPercent = Math.round((elapsed / baselineDurationDays) * 1000) / 10;

  const milestones: MilestoneDelay[] = project.milestones.map((m) => {
    const date = m.actual ?? m.forecast;
    return { name: m.name, planned: m.planned, date, finished: m.actual !== null, delayDays: daysBetween(m.planned, date) };
  });
  const worstMilestone = milestones.reduce<MilestoneDelay | null>(
    (w, m) => (m.delayDays > 0 && (!w || m.delayDays > w.delayDays) ? m : w),
    null,
  );

  const lateDays = Math.max(delayDays, 0);
  const exposure = lateDays * project.liquidatedDamagesPerDay;
  const cap = Math.round(project.contractValue * 0.1);
  return {
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    asOfDate,
    plannedCompletion: project.plannedCompletion,
    completionDate,
    completionBasis,
    delayDays,
    isDelayed: delayDays > 0,
    baselineDurationDays,
    timeElapsedPercent,
    percentComplete: project.percentComplete,
    progressGapPoints: Math.round((project.percentComplete - timeElapsedPercent) * 10) / 10,
    milestones,
    worstMilestone,
    liquidatedDamagesPerDay: project.liquidatedDamagesPerDay,
    liquidatedDamagesExposure: exposure,
    liquidatedDamagesCap: cap,
    liquidatedDamagesExposureCapped: Math.min(exposure, cap),
    recoveryScheduleRequired: delayDays > 14 && completionBasis === "forecast",
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  location: string;
  status: ProjectStatus;
  percentComplete: number;
  contractValue: number;
  plannedCompletion: string;
  forecastCompletion: string;
  delayDays: number;
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    location: `${p.city}, ${p.state}`,
    status: p.status,
    percentComplete: p.percentComplete,
    contractValue: p.contractValue,
    plannedCompletion: p.plannedCompletion,
    forecastCompletion: p.actualCompletion ?? p.forecastCompletion,
    delayDays: computeDelay(p).delayDays,
  };
}

export const formatUSD = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n >= 100_000_000 ? 0 : 1)}M`
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const formatUSDFull = (n: number): string => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function formatDate(iso: string): string {
  return new Date(parseDate(iso)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
