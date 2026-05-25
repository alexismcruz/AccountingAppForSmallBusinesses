// ── SSS (2023 rates: 14% total, 4.5% ee, 9.5% er + EC) ───────────────────────
function computeSSS(monthlySalary) {
  const salary = parseFloat(monthlySalary) || 0;
  // Monthly Salary Credit lookup
  const msc = salary < 4250
    ? 4000
    : Math.min(30000, Math.ceil(salary / 500) * 500);
  const employee = Math.round(msc * 0.045 * 100) / 100;
  const erSS     = Math.round(msc * 0.095 * 100) / 100;
  const ec       = msc >= 15000 ? 30 : 10; // Employees' Compensation (employer only)
  return { msc, employee, employer: Math.round((erSS + ec) * 100) / 100 };
}

// ── PhilHealth (2024: 5% of basic salary, ee/er split 50/50) ─────────────────
// Floor: ₱500 premium (₱10k salary); Ceiling: ₱5,000 premium (₱100k salary)
function computePhilHealth(monthlySalary) {
  const salary  = parseFloat(monthlySalary) || 0;
  const premium = Math.min(5000, Math.max(500, salary * 0.05));
  const half    = Math.round(premium / 2 * 100) / 100;
  return { employee: half, employer: half };
}

// ── Pag-IBIG / HDMF ──────────────────────────────────────────────────────────
// Salary ≤ ₱1,500: ee 1%; Salary > ₱1,500: ee 2%. er always 2%.
// Salary ceiling for computation: ₱5,000 → max employee ₱100, max employer ₱100
function computePagIbig(monthlySalary) {
  const salary  = parseFloat(monthlySalary) || 0;
  const base    = Math.min(salary, 5000);
  const eeRate  = salary <= 1500 ? 0.01 : 0.02;
  return {
    employee: Math.round(base * eeRate * 100) / 100,
    employer: Math.round(base * 0.02   * 100) / 100,
  };
}

// ── BIR Withholding Tax on Compensation (TRAIN Law 2023+) ────────────────────
// Source: BIR Revenue Regulations 8-2018 (TRAIN Law)
// brackets: [lowerBound, upperBound, baseTax, rate]
const BRACKETS = {
  monthly: [
    [0,          20833.33,   0,          0.00],
    [20833.33,   33333.33,   0,          0.15],
    [33333.33,   66666.67,   1875.00,    0.20],
    [66666.67,  166666.67,   8541.80,    0.25],
    [166666.67, 666666.67,  33541.80,    0.30],
    [666666.67,  Infinity,  183541.80,   0.35],
  ],
  semi_monthly: [
    [0,          10416.67,   0,          0.00],
    [10416.67,   16666.67,   0,          0.15],
    [16666.67,   33333.33,   937.50,     0.20],
    [33333.33,   83333.33,  4270.83,     0.25],
    [83333.33,  333333.33, 16770.83,     0.30],
    [333333.33,  Infinity,  91770.83,    0.35],
  ],
};

function computeWTax(taxableCompensation, payFrequency) {
  const income   = parseFloat(taxableCompensation) || 0;
  if (income <= 0) return 0;
  const brackets = BRACKETS[payFrequency] || BRACKETS.semi_monthly;
  for (const [min, max, base, rate] of brackets) {
    if (income < max) {
      return Math.round((base + Math.max(0, income - min) * rate) * 100) / 100;
    }
  }
  return 0;
}

// ── Full payroll entry computation ────────────────────────────────────────────
// Call with an employee record + adjustments + the pay_frequency for the period.
// adjustments: { overtime_pay, holiday_pay, allowances, other_deductions }
function computeEntry(employee, adjustments = {}, payFrequency = 'semi_monthly') {
  const monthlySalary = parseFloat(employee.basic_salary) || 0;
  const periods       = payFrequency === 'monthly' ? 1 : 2;

  const basicPay     = Math.round(monthlySalary / periods * 100) / 100;
  const overtimePay  = parseFloat(adjustments.overtime_pay)  || 0;
  const holidayPay   = parseFloat(adjustments.holiday_pay)   || 0;
  const allowances   = parseFloat(adjustments.allowances)    || 0;
  const otherDed     = parseFloat(adjustments.other_deductions) || 0;

  const grossPay = Math.round((basicPay + overtimePay + holidayPay + allowances) * 100) / 100;

  // Government contributions (monthly amounts ÷ pay periods)
  const sss = computeSSS(monthlySalary);
  const ph  = computePhilHealth(monthlySalary);
  const pi  = computePagIbig(monthlySalary);

  const r = (v) => Math.round(v / periods * 100) / 100;
  const sssEe = r(sss.employee);
  const sssEr = r(sss.employer);
  const phEe  = r(ph.employee);
  const phEr  = r(ph.employer);
  const piEe  = r(pi.employee);
  const piEr  = r(pi.employer);

  // Taxable compensation = gross - mandatory employee deductions
  const taxableComp = Math.max(0, grossPay - sssEe - phEe - piEe);
  const wtax        = computeWTax(taxableComp, payFrequency);

  const totalDeductions = Math.round((sssEe + phEe + piEe + wtax + otherDed) * 100) / 100;
  const netPay          = Math.round((grossPay - totalDeductions) * 100) / 100;

  return {
    basic_pay:            basicPay,
    overtime_pay:         overtimePay,
    holiday_pay:          holidayPay,
    allowances,
    gross_pay:            grossPay,
    sss_employee:         sssEe,
    sss_employer:         sssEr,
    philhealth_employee:  phEe,
    philhealth_employer:  phEr,
    pagibig_employee:     piEe,
    pagibig_employer:     piEr,
    wtax,
    other_deductions:     otherDed,
    total_deductions:     totalDeductions,
    net_pay:              netPay,
    // Breakdown metadata for payslip
    sss_msc:              sss.msc,
    taxable_compensation: Math.round(taxableComp * 100) / 100,
  };
}

module.exports = { computeSSS, computePhilHealth, computePagIbig, computeWTax, computeEntry };
