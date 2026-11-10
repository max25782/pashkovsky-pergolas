import {
  AMOUNT_NOT_SET_LABEL,
  buildPlannedFlows,
  flowAmount,
  projectBalance,
  recurringMonthForecast,
  sumFlows,
  variableFlows,
  type EventRow,
  type RuleRow,
} from "@/lib/tazrim/cash-flow";
import {
  monthBounds,
  nextOccurrence,
  ruleOccurrences,
} from "@/lib/tazrim/recurring-schedule";

const TODAY = "2026-11-10";

function rule(overrides: Partial<RuleRow> & { id: string }): RuleRow {
  return {
    label: "חיוב",
    amount: 1000,
    is_variable: false,
    frequency: "monthly",
    next_due_date: "2026-10-05",
    vendors: null,
    ...overrides,
  };
}

// The rules as saved in production on 2026-11-10: monthly dates still in
// October, the yearly rent already in November.
const PRODUCTION_RULES: RuleRow[] = [
  rule({ id: "finance", label: "חברת פיננסים", amount: 7670, next_due_date: "2026-10-05" }),
  rule({ id: "citroen", label: "סיטרואן", amount: 1080, next_due_date: "2026-10-10" }),
  rule({
    id: "cal",
    label: "כרטיס אשראי",
    amount: 11000,
    is_variable: true,
    next_due_date: "2026-10-10",
    vendors: { name: "כאל" },
  }),
  rule({ id: "loan-d1", amount: 1000, next_due_date: "2026-10-25" }),
  rule({ id: "loan-l", amount: 1200, next_due_date: "2026-10-25" }),
  rule({ id: "loan-d2", amount: 2100, next_due_date: "2026-10-25" }),
  rule({ id: "loan-h", amount: 5500, next_due_date: "2026-10-25" }),
  rule({
    id: "rent",
    label: "שכירות",
    amount: 19800,
    frequency: "yearly",
    next_due_date: "2026-11-25",
  }),
];

function ruleEvent(overrides: Partial<EventRow>): EventRow {
  return {
    id: "ev1",
    type: "expense",
    amount: 1000,
    due_date: "2026-11-05",
    status: "planned",
    notes: null,
    payment_method: null,
    recurring_rule_id: "finance",
    debt_id: null,
    vendors: null,
    checks: null,
    ...overrides,
  };
}

describe("ruleOccurrences", () => {
  it("puts a monthly charge whose saved date is last month into the current month", () => {
    const monthly = rule({ id: "m", next_due_date: "2026-10-05" });
    expect(ruleOccurrences(monthly, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-05",
    ]);
  });

  it("repeats a monthly charge in every month of a longer window", () => {
    const monthly = rule({ id: "m", next_due_date: "2026-10-25" });
    expect(ruleOccurrences(monthly, "2026-11-10", "2027-01-31")).toEqual([
      "2026-11-25",
      "2026-12-25",
      "2027-01-25",
    ]);
  });

  it("clamps day 31 to the end of shorter months", () => {
    const monthly = rule({ id: "m", next_due_date: "2026-10-31" });
    expect(ruleOccurrences(monthly, "2026-11-01", "2027-02-28")).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
  });

  it("gives a yearly charge once per year, in its own month only", () => {
    const yearly = rule({ id: "y", frequency: "yearly", next_due_date: "2026-11-25" });
    expect(ruleOccurrences(yearly, "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-25",
    ]);
    expect(ruleOccurrences(yearly, "2026-01-01", "2026-10-31")).toEqual([]);
  });

  it("keeps a yearly charge in its month when the saved date is a year stale", () => {
    const yearly = rule({ id: "y", frequency: "yearly", next_due_date: "2025-11-25" });
    expect(ruleOccurrences(yearly, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-25",
    ]);
  });

  it("falls back to the saved date for an unknown frequency", () => {
    const odd = rule({ id: "o", frequency: "weekly", next_due_date: "2026-11-12" });
    expect(ruleOccurrences(odd, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-12",
    ]);
  });

  it("returns nothing without a saved date", () => {
    const none = rule({ id: "n", next_due_date: null });
    expect(ruleOccurrences(none, "2026-11-01", "2026-11-30")).toEqual([]);
  });
});

describe("nextOccurrence", () => {
  it("rolls stale monthly dates forward and keeps the yearly one", () => {
    const next = Object.fromEntries(
      PRODUCTION_RULES.map((r) => [r.id, nextOccurrence(r, TODAY)])
    );
    expect(next.finance).toBe("2026-12-05");
    expect(next.citroen).toBe("2026-11-10");
    expect(next["loan-h"]).toBe("2026-11-25");
    expect(next.rent).toBe("2026-11-25");
  });
});

describe("recurring flows in the cash picture", () => {
  const window = { from: TODAY, to: "2026-11-30" };

  it("includes a monthly charge dated last month in the rest of the month", () => {
    const flows = buildPlannedFlows([], PRODUCTION_RULES, window);
    const ids = flows.map((f) => f.key);
    expect(ids).toContain("rule-citroen-2026-11-10");
    expect(ids).toContain("rule-loan-h-2026-11-25");
    // The 5th is behind us on the 10th: not a flow of the remaining days.
    expect(ids).not.toContain("rule-finance-2026-11-05");
  });

  it("does not duplicate the yearly charge", () => {
    const flows = buildPlannedFlows([], PRODUCTION_RULES, {
      from: "2026-11-01",
      to: "2027-01-31",
    });
    expect(flows.filter((f) => f.key.startsWith("rule-rent-"))).toHaveLength(1);
  });

  it("does not add a rule occurrence that already exists as an event", () => {
    const flows = buildPlannedFlows(
      [ruleEvent({ recurring_rule_id: "citroen", due_date: "2026-11-10", amount: 1080 })],
      PRODUCTION_RULES,
      window
    );
    const keys = flows.map((f) => f.key);
    expect(keys).toContain("event-ev1");
    expect(keys.some((k) => k.startsWith("rule-citroen-"))).toBe(false);
  });

  it("does not add a rule occurrence whose event is already cleared", () => {
    const flows = buildPlannedFlows(
      [
        ruleEvent({
          recurring_rule_id: "citroen",
          due_date: "2026-11-10",
          amount: 1080,
          status: "cleared",
        }),
      ],
      PRODUCTION_RULES,
      window
    );
    expect(flows.some((f) => f.key.includes("citroen"))).toBe(false);
  });

  it("subtracts the charges from the projected balance on their days", () => {
    const flows = buildPlannedFlows([], PRODUCTION_RULES, window);
    const days = projectBalance(100000, flows, TODAY, "2026-11-30");
    // Citroen 1,080 today (Cal is variable, not subtracted).
    expect(days[0].balance).toBe(100000 - 1080);
    // Loans 1,000 + 1,200 + 2,100 + 5,500 and the 19,800 rent on the 25th.
    expect(days.find((d) => d.date === "2026-11-25")?.expense).toBe(29600);
  });
});

describe("variable amounts", () => {
  const window = { from: "2026-11-01", to: "2026-11-30" };

  it("lists a variable charge separately and does not sum it", () => {
    const flows = buildPlannedFlows([], PRODUCTION_RULES, window);
    const variable = variableFlows(flows);
    expect(variable).toHaveLength(1);
    expect(variable[0].vendorName).toBe("כאל");
    expect(variable[0].amount).toBeNull();
    expect(variable[0].amountEstimate).toBe(11000);
    expect(sumFlows(flows, "out", "2026-11-01", "2026-11-30")).toBe(38350);
  });

  it("shows an unset amount as 'amount not set', not as zero", () => {
    const unset = rule({ id: "u", amount: null, is_variable: true, next_due_date: "2026-11-20" });
    const [flow] = buildPlannedFlows([], [unset], window);
    expect(flow.amount).toBeNull();
    expect(flow.amountEstimate).toBeNull();
    expect(flowAmount(flow)).toBe(AMOUNT_NOT_SET_LABEL);
  });

  it("shows a saved estimate next to the variable label", () => {
    const flows = buildPlannedFlows([], PRODUCTION_RULES, window);
    const cal = flows.find((f) => f.key.startsWith("rule-cal-"));
    expect(cal && flowAmount(cal)).toContain("11,000");
    expect(cal && flowAmount(cal)).toContain("משתנה");
  });
});

describe("recurringMonthForecast for November 2026", () => {
  const { start, end } = monthBounds(TODAY);

  it("counts every November charge, including the 5th that is already past", () => {
    const month = recurringMonthForecast([], PRODUCTION_RULES, start, end);
    expect(month.flows.map((f) => f.date)).toEqual([
      "2026-11-05",
      "2026-11-10",
      "2026-11-10",
      "2026-11-25",
      "2026-11-25",
      "2026-11-25",
      "2026-11-25",
      "2026-11-25",
    ]);
    // 7,670 + 1,080 + 1,000 + 1,200 + 2,100 + 5,500 + rent 19,800
    expect(month.fixedTotal).toBe(38350);
  });

  it("reports the Cal credit-card charge as variable, outside the total", () => {
    const month = recurringMonthForecast([], PRODUCTION_RULES, start, end);
    expect(month.variable).toHaveLength(1);
    expect(month.variable[0].vendorName).toBe("כאל");
    expect(month.variable[0].date).toBe("2026-11-10");
  });

  it("counts the yearly rent once", () => {
    const month = recurringMonthForecast([], PRODUCTION_RULES, start, end);
    expect(month.flows.filter((f) => f.key.startsWith("rule-rent-"))).toHaveLength(1);
  });

  it("uses a generated event instead of the rule occurrence for the same day", () => {
    const month = recurringMonthForecast(
      [ruleEvent({ recurring_rule_id: "finance", due_date: "2026-11-05", amount: 7670 })],
      PRODUCTION_RULES,
      start,
      end
    );
    expect(month.flows.filter((f) => f.date === "2026-11-05")).toHaveLength(1);
    expect(month.fixedTotal).toBe(38350);
  });
});
