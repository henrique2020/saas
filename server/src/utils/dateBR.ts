/**
 * Utilitários de data com regras de dia útil (fuso America/Sao_Paulo).
 *
 * Regra de negócio: o sistema armazena apenas a data-com. A data-ex é
 * derivada dinamicamente adicionando sempre 1 dia útil à data-com
 * (pulando sábados e domingos).
 */

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // domingo (0) ou sábado (6)
}

/** Adiciona `n` dias úteis a uma data (pulando fins de semana). */
export function addBusinessDays(date: Date, n: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < n) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added++;
  }
  return result;
}

/** Subtrai `n` dias úteis de uma data (pulando fins de semana). */
export function subtractBusinessDays(date: Date, n: number): Date {
  const result = new Date(date);
  let removed = 0;
  while (removed < n) {
    result.setDate(result.getDate() - 1);
    if (!isWeekend(result)) removed++;
  }
  return result;
}

/** Calcula a data-ex a partir da data-com (data-com + 1 dia útil). */
export function getExDate(comDate: Date | string): Date {
  const d = typeof comDate === 'string' ? new Date(comDate) : comDate;
  return addBusinessDays(d, 1);
}

/** Deriva a data-com a partir de uma data-ex externa (data-ex - 1 dia útil). */
export function getComDateFromEx(exDate: Date | string): Date {
  const d = typeof exDate === 'string' ? new Date(exDate) : exDate;
  return subtractBusinessDays(d, 1);
}

/** Normaliza uma data para o início do dia em UTC (00:00:00.000Z), ignorando fuso/horário. */
export function toStartOfDayUTC(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

