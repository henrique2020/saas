import { describe, it, expect } from 'vitest';
import {
  calculateFixedIncome,
  daysBetween,
  getIncomeTaxRate,
  getRateAt,
  resolveAnnualRate,
  monthlyToAnnual,
  accumulatedIpca,
  RatePeriod,
} from './fixedIncome';

const periods: RatePeriod[] = [
  { type: 'SELIC', rate: 10, startDate: new Date(2024, 0, 1) },
  { type: 'SELIC', rate: 12, startDate: new Date(2025, 0, 1) },
  // IPCA é cadastrado como variação MENSAL
  { type: 'IPCA', rate: 0.5, startDate: new Date(2024, 0, 1) },
];

describe('daysBetween', () => {
  it('conta dias corridos entre datas', () => {
    expect(daysBetween(new Date(2024, 0, 1), new Date(2024, 0, 31))).toBe(30);
  });

  it('retorna 0 para intervalos invertidos', () => {
    expect(daysBetween(new Date(2024, 5, 1), new Date(2024, 0, 1))).toBe(0);
  });
});

describe('getIncomeTaxRate', () => {
  it('aplica a tabela regressiva', () => {
    expect(getIncomeTaxRate(180)).toBe(0.225);
    expect(getIncomeTaxRate(181)).toBe(0.2);
    expect(getIncomeTaxRate(360)).toBe(0.2);
    expect(getIncomeTaxRate(361)).toBe(0.175);
    expect(getIncomeTaxRate(720)).toBe(0.175);
    expect(getIncomeTaxRate(721)).toBe(0.15);
  });
});

describe('getRateAt', () => {
  it('usa a taxa vigente na data', () => {
    expect(getRateAt(periods, 'SELIC', new Date(2024, 6, 1))).toBe(10);
    expect(getRateAt(periods, 'SELIC', new Date(2025, 6, 1))).toBe(12);
  });

  it('cai para a taxa mais antiga quando a data é anterior a todas', () => {
    expect(getRateAt(periods, 'SELIC', new Date(2020, 0, 1))).toBe(10);
  });

  it('retorna null quando o índice não existe', () => {
    expect(getRateAt(periods, 'TR', new Date(2024, 0, 1))).toBeNull();
  });
});

describe('monthlyToAnnual', () => {
  it('anualiza compondo 12 meses', () => {
    expect(monthlyToAnnual(0.5)).toBeCloseTo((Math.pow(1.005, 12) - 1) * 100, 10);
    expect(monthlyToAnnual(0)).toBeCloseTo(0, 10);
  });

  it('aceita deflação (variação negativa)', () => {
    expect(monthlyToAnnual(-0.1)).toBeLessThan(0);
  });
});

describe('accumulatedIpca', () => {
  const mensais: RatePeriod[] = [
    { type: 'IPCA', rate: 0.5, startDate: new Date(2025, 0, 1) },
    { type: 'IPCA', rate: 0.5, startDate: new Date(2025, 1, 1) },
    { type: 'IPCA', rate: -0.2, startDate: new Date(2025, 2, 1) },
  ];

  it('compõe as variações mensais da janela', () => {
    const esperado = (1.005 * 1.005 * 0.998 - 1) * 100;
    expect(accumulatedIpca(mensais, 12, new Date(2025, 5, 1))).toBeCloseTo(esperado, 10);
  });

  it('limita a janela ao número de meses pedido', () => {
    const esperado = (1.005 * 0.998 - 1) * 100;
    expect(accumulatedIpca(mensais, 2, new Date(2025, 5, 1))).toBeCloseTo(esperado, 10);
  });

  it('retorna null sem IPCA cadastrado', () => {
    expect(accumulatedIpca([], 12, new Date(2025, 5, 1))).toBeNull();
  });
});

describe('resolveAnnualRate', () => {
  const date = new Date(2024, 6, 1);

  it('prefixado usa a própria taxa', () => {
    expect(resolveAnnualRate('PRE', 11.5, periods, date)).toBe(11.5);
  });

  it('CDI aplica o percentual sobre o índice derivado da Selic', () => {
    // Selic 10% -> CDI 9,9% -> 110% do CDI = 10,89%
    expect(resolveAnnualRate('CDI', 110, periods, date)).toBeCloseTo(10.89, 6);
    expect(resolveAnnualRate('CDI', 100, periods, date)).toBeCloseTo(9.9, 6);
  });

  it('Selic soma o spread', () => {
    expect(resolveAnnualRate('SELIC', 0.5, periods, date)).toBe(10.5);
  });

  it('IPCA anualiza a variação mensal e aplica o spread de forma multiplicativa', () => {
    // IPCA 0,5% a.m. -> (1,005^12 - 1) = 6,1678% a.a. | spread 6% -> (1,061678 * 1,06 - 1)
    const ipcaAnual = Math.pow(1.005, 12) - 1;
    const esperado = ((1 + ipcaAnual) * 1.06 - 1) * 100;
    expect(resolveAnnualRate('IPCA', 6, periods, date)).toBeCloseTo(esperado, 10);
  });

  it('IPCA com deflação pode gerar taxa anual negativa sem spread', () => {
    const deflacao: RatePeriod[] = [{ type: 'IPCA', rate: -0.5, startDate: new Date(2024, 0, 1) }];
    expect(resolveAnnualRate('IPCA', 0, deflacao, date)!).toBeLessThan(0);
  });

  it('ignora um CDI eventualmente cadastrado e sempre deriva da Selic', () => {
    const comCdiCadastrado: RatePeriod[] = [
      ...periods,
      { type: 'CDI', rate: 5, startDate: new Date(2024, 0, 1) },
    ];
    expect(resolveAnnualRate('CDI', 100, comCdiCadastrado, date)).toBeCloseTo(9.9, 6);
  });

  it('retorna null para CDI quando não há Selic cadastrada', () => {
    const semSelic = periods.filter((p) => p.type !== 'SELIC');
    expect(resolveAnnualRate('CDI', 100, semSelic, date)).toBeNull();
  });
});

describe('calculateFixedIncome', () => {
  it('capitaliza um prefixado de 1 ano e aplica IR de 17,5%', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2024, 11, 31),
        taxExempt: false,
      },
      periods,
      new Date(2025, 0, 15)
    );

    expect(result.daysTotal).toBe(365);
    expect(result.projectedGrossValue).toBeCloseTo(1100, 2);
    expect(result.taxRate).toBe(0.175);
    expect(result.projectedTax).toBeCloseTo(17.5, 2);
    expect(result.projectedNetValue).toBeCloseTo(1082.5, 2);
    expect(result.matured).toBe(true);
  });

  it('não desconta IR quando isento', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2024, 11, 31),
        taxExempt: true,
      },
      periods,
      new Date(2025, 0, 15)
    );

    expect(result.taxRate).toBe(0);
    expect(result.projectedTax).toBe(0);
    expect(result.projectedNetValue).toBeCloseTo(result.projectedGrossValue, 6);
  });

  it('respeita a mudança de taxa Selic no meio do período', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'SELIC',
        rate: 0,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2025, 11, 31),
        taxExempt: true,
      },
      periods,
      new Date(2026, 0, 15)
    );

    // 366 dias (2024 é bissexto) a 10% + 364 dias a 12%
    const esperado = 1000 * Math.pow(1.1, 366 / 365) * Math.pow(1.12, 364 / 365);
    expect(result.projectedGrossValue).toBeCloseTo(esperado, 6);
    expect(result.effectiveAnnualRate).toBeGreaterThan(10);
    expect(result.effectiveAnnualRate).toBeLessThan(12);
  });

  it('acumula apenas até hoje no valor corrente', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2026, 0, 1),
        taxExempt: true,
      },
      periods,
      new Date(2024, 11, 31)
    );

    expect(result.daysElapsed).toBe(365);
    expect(result.currentGrossValue).toBeCloseTo(1100, 2);
    expect(result.currentGrossValue).toBeLessThan(result.projectedGrossValue);
    expect(result.matured).toBe(false);
  });

  it('usa o valor recebido quando o investimento é encerrado', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2024, 11, 31),
        taxExempt: false,
        settledAmount: 1075.5,
        settledDate: new Date(2024, 11, 31),
      },
      periods,
      new Date(2025, 0, 15)
    );

    expect(result.settled).toBe(true);
    expect(result.currentValue).toBe(1075.5);
    expect(result.realizedProfit).toBeCloseTo(75.5, 2);
  });

  it('não capitaliza quando não há taxa cadastrada para o índice', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'IPCA',
        rate: 5,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2025, 0, 1),
        taxExempt: true,
      },
      [],
      new Date(2025, 0, 15)
    );

    expect(result.projectedGrossValue).toBeCloseTo(1000, 6);
    expect(result.projectedGrossProfit).toBeCloseTo(0, 6);
  });

  it('expõe o valor corrente já líquido de IR pela faixa do prazo decorrido', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2026, 0, 1),
        taxExempt: false,
      },
      periods,
      new Date(2024, 11, 31)
    );

    // 365 dias decorridos -> faixa de 17,5%
    expect(result.currentTaxRate).toBe(0.175);
    expect(result.currentGrossValue).toBeCloseTo(1100, 2);
    expect(result.currentTax).toBeCloseTo(17.5, 2);
    expect(result.currentNetValue).toBeCloseTo(1082.5, 2);
    expect(result.currentValue).toBeCloseTo(result.currentNetValue, 6);
    expect(result.currentNetProfit).toBeCloseTo(82.5, 2);
    // IR projetado usa a faixa do prazo até o vencimento (731 dias -> 15%)
    expect(result.taxRate).toBe(0.15);
  });

  it('para de render após a data de encerramento', () => {
    const base = {
      yieldType: 'PRE' as const,
      rate: 10,
      contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
      maturityDate: new Date(2026, 0, 1),
      taxExempt: true,
    };

    const encerrado = calculateFixedIncome(
      { ...base, settledDate: new Date(2024, 11, 31) },
      periods,
      new Date(2025, 11, 31)
    );

    expect(encerrado.daysElapsed).toBe(365);
    expect(encerrado.currentGrossValue).toBeCloseTo(1100, 2);
  });

  it('calcula a diferença entre o valor recebido e o esperado no encerramento', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [{ amount: 1000, date: new Date(2024, 0, 1) }],
        maturityDate: new Date(2024, 11, 31),
        taxExempt: true,
        settledAmount: 1090,
        settledDate: new Date(2024, 11, 31),
      },
      periods,
      new Date(2025, 0, 15)
    );

    expect(result.expectedNetAtSettlement).toBeCloseTo(1100, 2);
    expect(result.settlementDiff).toBeCloseTo(-10, 2);
  });
});

describe('calculateFixedIncome com múltiplos aportes', () => {
  it('capitaliza cada aporte a partir da sua própria data', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [
          { amount: 1000, date: new Date(2024, 0, 1) },
          { amount: 1000, date: new Date(2024, 11, 31) },
        ],
        maturityDate: new Date(2025, 11, 31),
        taxExempt: true,
      },
      periods,
      new Date(2026, 0, 15)
    );

    // 1º aporte: 2 anos a 10% | 2º aporte: 1 ano a 10%
    expect(result.investedAmount).toBe(2000);
    expect(result.projectedGrossValue).toBeCloseTo(1000 * 1.21 + 1000 * 1.1, 2);
    expect(result.contributions).toHaveLength(2);
    expect(result.contributions[0].projectedGrossValue).toBeCloseTo(1210, 2);
    expect(result.contributions[1].projectedGrossValue).toBeCloseTo(1100, 2);
  });

  it('aplica a alíquota de IR pelo prazo individual de cada aporte', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [
          // 1096 dias até o vencimento -> 15%
          { amount: 1000, date: new Date(2023, 0, 1) },
          // 150 dias até o vencimento -> 22,5%
          { amount: 1000, date: new Date(2025, 7, 4) },
        ],
        maturityDate: new Date(2026, 0, 1),
        taxExempt: false,
      },
      periods,
      new Date(2026, 0, 15)
    );

    expect(result.contributions[0].taxRate).toBe(0.15);
    expect(result.contributions[1].taxRate).toBe(0.225);
    expect(result.projectedTax).toBeCloseTo(
      result.contributions[0].projectedTax + result.contributions[1].projectedTax,
      6
    );
    // Alíquota média fica entre as duas faixas
    expect(result.taxRate).toBeGreaterThan(0.15);
    expect(result.taxRate).toBeLessThan(0.225);
  });

  it('usa a data do primeiro aporte como início do investimento', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [
          { amount: 500, date: new Date(2025, 5, 1) },
          { amount: 500, date: new Date(2024, 0, 1) },
        ],
        maturityDate: new Date(2026, 0, 1),
        taxExempt: true,
      },
      periods,
      new Date(2025, 6, 1)
    );

    expect(result.firstContributionDate?.getTime()).toBe(new Date(2024, 0, 1).getTime());
    expect(result.daysTotal).toBe(daysBetween(new Date(2024, 0, 1), new Date(2026, 0, 1)));
    expect(result.contributions[0].date.getTime()).toBe(new Date(2024, 0, 1).getTime());
  });

  it('não capitaliza aportes com data futura', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [
          { amount: 1000, date: new Date(2024, 0, 1) },
          { amount: 1000, date: new Date(2026, 0, 1) },
        ],
        maturityDate: new Date(2027, 0, 1),
        taxExempt: true,
      },
      periods,
      new Date(2025, 0, 1)
    );

    // Em 01/01/2025 o segundo aporte ainda não ocorreu
    expect(result.contributions[1].currentGrossValue).toBe(1000);
    expect(result.currentGrossValue).toBeCloseTo(1000 * Math.pow(1.1, 366 / 365) + 1000, 2);
  });

  it('rendimento realizado considera a soma dos aportes', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [
          { amount: 1000, date: new Date(2024, 0, 1) },
          { amount: 2000, date: new Date(2024, 6, 1) },
        ],
        maturityDate: new Date(2025, 0, 1),
        taxExempt: true,
        settledAmount: 3300,
        settledDate: new Date(2025, 0, 1),
      },
      periods,
      new Date(2025, 0, 15)
    );

    expect(result.investedAmount).toBe(3000);
    expect(result.currentValue).toBe(3300);
    expect(result.realizedProfit).toBeCloseTo(300, 6);
  });

  it('retorna zeros quando não há aportes', () => {
    const result = calculateFixedIncome(
      {
        yieldType: 'PRE',
        rate: 10,
        contributions: [],
        maturityDate: new Date(2025, 0, 1),
        taxExempt: false,
      },
      periods,
      new Date(2024, 6, 1)
    );

    expect(result.investedAmount).toBe(0);
    expect(result.projectedGrossValue).toBe(0);
    expect(result.effectiveAnnualRate).toBe(0);
    expect(result.firstContributionDate).toBeNull();
  });
});

