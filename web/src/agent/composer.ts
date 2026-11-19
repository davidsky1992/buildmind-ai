import { sentences, tokenize } from "../rag/text";
import { formatDate, formatUSD, formatUSDFull, type DelayAnalysis } from "../tools/projectData";
import type { DelayedProjectsResult, ProjectDetailsResult, SearchProjectsResult } from "../tools/projectTools";
import type { KnowledgeSearchResult } from "../tools/knowledgeTool";
import type { ExecutionContext } from "./context";

export type AnswerBlock =
  | { kind: "text"; text: string } // supports **bold** and [n] citation markers
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "kv"; rows: [string, string][] }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "quote"; text: string; citation: number }
  | { kind: "warning"; text: string };

export interface Citation {
  n: number;
  chunkId: string;
  docId: string;
  docName: string;
  page: number | null;
  heading: string | null;
  score: number;
  text: string;
  matchedTerms: string[];
}

export interface AgentAnswer {
  blocks: AnswerBlock[];
  citations: Citation[];
  /** Plain-text version (used for conversation history and tests). */
  plainText: string;
}

const signed = (d: number) => (d > 0 ? `+${d}` : `${d}`);

/** Step 9: deterministic, template-based answer built only from tool results. */
export class ResponseComposer {
  compose(ctx: ExecutionContext): AgentAnswer {
    const blocks: AnswerBlock[] = [];
    const citations: Citation[] = [];
    const intents = ctx.analysis.intents;

    if (intents.includes("greeting")) {
      blocks.push(
        { kind: "text", text: "Hi! I'm the BuildMind assistant, a **deterministic, rule-based agent** (not an LLM). I can:" },
        {
          kind: "bullets",
          items: [
            "find projects by type, location or status (e.g. *Which projects are in North Carolina?*)",
            "rank delayed projects and calculate days late and liquidated-damages exposure",
            "show the full record for a project (e.g. *Details for BM-104*)",
            "answer questions from the knowledge base with cited passages (e.g. *What are the cold-weather concreting requirements?*)",
          ],
        },
      );
      return finalize(blocks, citations);
    }

    const lead = this.lead(ctx);
    if (lead) blocks.push({ kind: "text", text: lead });

    for (const call of ctx.calls) {
      if (call.status === "invalid") {
        blocks.push({ kind: "warning", text: `The call to \`${call.tool}\` was rejected during argument validation: ${call.validationErrors.join("; ")}.` });
        continue;
      }
      if (call.status === "error") {
        blocks.push({ kind: "warning", text: `\`${call.tool}\` failed: ${call.error}` });
        continue;
      }
      switch (call.tool) {
        case "get_delayed_projects":
          blocks.push(...delayedBlocks(call.result as DelayedProjectsResult));
          break;
        case "search_projects":
          blocks.push(...searchBlocks(call.result as SearchProjectsResult));
          break;
        case "get_project_details":
          blocks.push(...detailBlocks(call.result as ProjectDetailsResult));
          break;
        case "calculate_project_delay":
          blocks.push(...delayCalcBlocks(call.result as DelayAnalysis));
          break;
        case "search_knowledge_base":
          blocks.push(...knowledgeBlocks(call.result as KnowledgeSearchResult, citations));
          break;
      }
    }

    if (!ctx.calls.length) blocks.push({ kind: "text", text: "I could not map this request to any of my tools. Try one of the sample questions." });
    return finalize(blocks, citations);
  }

  /** One-sentence synthesis across tools, when the combination warrants it. */
  private lead(ctx: ExecutionContext): string | null {
    const delayed = ctx.latest<DelayedProjectsResult>("get_delayed_projects");
    const calc = ctx.latest<DelayAnalysis>("calculate_project_delay");
    if (delayed && calc && ctx.analysis.entities.superlative && delayed.projects[0]?.id === calc.projectId) {
      return `**${calc.projectId} ${calc.projectName}** is the most delayed project: forecast **${calc.delayDays} days** past its contract completion date, with an estimated liquidated-damages exposure of **${formatUSDFull(calc.liquidatedDamagesExposureCapped)}**.`;
    }
    return null;
  }
}

function finalize(blocks: AnswerBlock[], citations: Citation[]): AgentAnswer {
  const plain = blocks
    .map((b) => {
      switch (b.kind) {
        case "text":
        case "heading":
        case "warning":
          return b.text;
        case "bullets":
          return b.items.map((i) => `- ${i}`).join("\n");
        case "kv":
          return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
        case "table":
          return [b.columns.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n");
        case "quote":
          return `> ${b.text} [${b.citation}]`;
      }
    })
    .join("\n\n");
  return { blocks, citations, plainText: plain };
}

function delayedBlocks(r: DelayedProjectsResult): AnswerBlock[] {
  if (!r.count) return [{ kind: "text", text: `As of ${formatDate(r.asOfDate)}, no active project is forecast to finish ${r.minDelayDays}+ days late.` }];
  return [
    {
      kind: "text",
      text: `As of ${formatDate(r.asOfDate)}, **${r.count} project${r.count > 1 ? "s are" : " is"}** forecast to finish after the contract completion date${r.minDelayDays > 1 ? ` by at least ${r.minDelayDays} days` : ""}:`,
    },
    {
      kind: "table",
      columns: ["Project", "Status", "Days late", "Contract date", "Forecast", "LD exposure"],
      rows: r.projects.map((p) => [
        `${p.id} ${p.name}`,
        p.status,
        String(p.delayDays),
        formatDate(p.plannedCompletion),
        formatDate(p.forecastCompletion),
        formatUSD(p.liquidatedDamagesExposure),
      ]),
    },
    {
      kind: "text",
      text: `Combined liquidated-damages exposure (each project capped at 10% of contract value): **${formatUSDFull(r.totalExposure)}**. ${
        r.projects.filter((p) => p.recoveryScheduleRequired).length
      } of these are more than 14 days late.`,
    },
  ];
}

function searchBlocks(r: SearchProjectsResult): AnswerBlock[] {
  const f = Object.entries(r.filters).map(([k, v]) => `${k.replace("_", " ")} = "${v}"`).join(", ");
  if (!r.total) return [{ kind: "text", text: `No projects matched${f ? ` ${f}` : ""}.` }];
  return [
    { kind: "text", text: `Found **${r.total} project${r.total > 1 ? "s" : ""}**${f ? ` for ${f}` : ""}:` },
    {
      kind: "table",
      columns: ["Project", "Type", "Location", "Status", "Complete", "Value"],
      rows: r.projects.map((p) => [`${p.id} ${p.name}`, p.type, p.location, p.status, `${p.percentComplete}%`, formatUSD(p.contractValue)]),
    },
  ];
}

function detailBlocks(r: ProjectDetailsResult): AnswerBlock[] {
  const p = r.project;
  const next = p.milestones.find((m) => !m.actual);
  const blocks: AnswerBlock[] = [
    { kind: "heading", text: `${p.id} · ${p.name}` },
    { kind: "text", text: p.description },
    {
      kind: "kv",
      rows: [
        ["Status", p.status],
        ["Type / location", `${p.type} · ${p.city}, ${p.state}`],
        ["Client", p.client],
        ["Project manager", p.projectManager],
        ["General contractor", p.generalContractor],
        ["Contract value", formatUSDFull(p.contractValue)],
        ["Cost to date", `${formatUSDFull(p.costToDate)} (${r.budgetUsedPercent}% of contract)`],
        ["Progress", `${p.percentComplete}% complete vs ${r.delay.timeElapsedPercent}% of baseline time elapsed (${signed(r.delay.progressGapPoints)} pts)`],
        ["Contract completion", formatDate(p.plannedCompletion)],
        [
          r.delay.completionBasis === "actual" ? "Actual completion" : "Forecast completion",
          `${formatDate(r.delay.completionDate)} (${r.delay.delayDays === 0 ? "on time" : `${signed(r.delay.delayDays)} days`})`,
        ],
        ...(next ? [["Next milestone", `${next.name}, forecast ${formatDate(next.forecast)}`] as [string, string]] : []),
      ],
    },
  ];
  if (p.risks.length) blocks.push({ kind: "bullets", items: p.risks.map((k) => `**${k.severity} risk:** ${k.title}`) });
  return blocks;
}

function delayCalcBlocks(d: DelayAnalysis): AnswerBlock[] {
  const when = d.completionBasis === "actual" ? "finished" : "is forecast to finish";
  const headline =
    d.delayDays > 0
      ? `**${d.projectId}** ${when} on ${formatDate(d.completionDate)}, **${d.delayDays} calendar days** after its contract completion date of ${formatDate(d.plannedCompletion)}.`
      : `**${d.projectId}** ${when} on ${formatDate(d.completionDate)}, ${d.delayDays === 0 ? "exactly on" : `**${-d.delayDays} days ahead of**`} its contract completion date (${formatDate(d.plannedCompletion)}).`;
  const rows: [string, string][] = [
    ["Progress vs time", `${d.percentComplete}% complete, ${d.timeElapsedPercent}% of the ${d.baselineDurationDays}-day baseline elapsed (${signed(d.progressGapPoints)} pts)`],
  ];
  if (d.worstMilestone) rows.push(["Largest milestone slip", `${d.worstMilestone.name}: ${d.worstMilestone.delayDays} days (${d.worstMilestone.finished ? "actual" : "forecast"})`]);
  if (d.delayDays > 0) {
    rows.push(
      ["LD calculation", `${d.delayDays} days × ${formatUSDFull(d.liquidatedDamagesPerDay)}/day = ${formatUSDFull(d.liquidatedDamagesExposure)}`],
      ["LD cap (10% of contract)", formatUSDFull(d.liquidatedDamagesCap)],
      ["Estimated LD exposure", formatUSDFull(d.liquidatedDamagesExposureCapped)],
      ["Recovery schedule trigger (>14 days)", d.recoveryScheduleRequired ? "Yes" : "No"],
    );
  }
  return [
    { kind: "heading", text: `Delay analysis · ${d.projectId} ${d.projectName}` },
    { kind: "text", text: headline },
    { kind: "kv", rows },
    ...(d.delayDays > 0
      ? [{ kind: "text" as const, text: "Exposure is an estimate before any approved time extensions for excusable delay." }]
      : []),
  ];
}

/** Extractive answer: the best-matching sentences from the top chunks, each cited. */
function knowledgeBlocks(r: KnowledgeSearchResult, citations: Citation[]): AnswerBlock[] {
  if (!r.hits.length) {
    return [{ kind: "text", text: `I searched ${r.indexedChunks} document chunks but found no passage matching "${r.query}".` }];
  }
  const qTerms = new Set(tokenize(r.query));
  const topScore = r.hits[0].score;
  const minTerms = Math.min(2, qTerms.size);
  const used = r.hits.filter((h, i) => i === 0 || (h.score >= topScore * 0.5 && h.matchedTerms.length >= minTerms)).slice(0, 3);
  const blocks: AnswerBlock[] = [{ kind: "text", text: "Relevant passages from the knowledge base:" }];

  for (const hit of used) {
    const n = citations.length + 1;
    citations.push({ n, ...hit });
    const scored = sentences(hit.text).map((s, i) => {
      const terms = new Set(tokenize(s));
      const overlap = [...qTerms].filter((t) => terms.has(t)).length;
      return { s, i, score: overlap / Math.sqrt(Math.max(terms.size, 8)) };
    });
    const best = [...scored].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 2).filter((x, k, arr) => k === 0 || (x.score > 0.5 && x.score >= arr[0].score * 0.75));
    const quote = best.sort((a, b) => a.i - b.i).map((x) => x.s).join(" … ");
    blocks.push({ kind: "quote", text: quote, citation: n });
  }
  blocks.push({
    kind: "text",
    text: `Sources: ${citations.slice(-used.length).map((c) => `[${c.n}] ${c.docName}${c.page ? `, p. ${c.page}` : ""}${c.heading ? ` (${c.heading})` : ""}`).join("; ")}.`,
  });
  return blocks;
}
