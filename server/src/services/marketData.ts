import axios from 'axios';

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;
const YAHOO_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Track Alpha Vantage daily usage to know when to fallback
let alphaCallsToday = 0;
let alphaLastResetDate = new Date().toDateString();
const ALPHA_DAILY_LIMIT = 24; // Reserve 1 buffer below 25

function checkAlphaReset() {
  const today = new Date().toDateString();
  if (today !== alphaLastResetDate) {
    alphaCallsToday = 0;
    alphaLastResetDate = today;
  }
}

function isAlphaAvailable(): boolean {
  checkAlphaReset();
  return !!ALPHA_VANTAGE_KEY && alphaCallsToday < ALPHA_DAILY_LIMIT;
}

function recordAlphaCall() {
  checkAlphaReset();
  alphaCallsToday++;
}

// ========== QUOTE ==========

export interface QuoteResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  market: 'BR' | 'US';
  source: 'alpha_vantage' | 'yahoo';
}

async function getAlphaVantageQuote(ticker: string, market: 'BR' | 'US'): Promise<QuoteResult | null> {
  if (!isAlphaAvailable()) return null;

  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    recordAlphaCall();
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'GLOBAL_QUOTE', symbol, apikey: ALPHA_VANTAGE_KEY },
      timeout: 10000,
    });

    const data = response.data?.['Global Quote'];
    if (!data || !data['05. price']) return null;

    // Check for rate limit response (Alpha returns "Note" or "Information" key when limited)
    if (response.data?.['Note'] || response.data?.['Information']) {
      console.warn('[market-data] Alpha Vantage rate limited');
      return null;
    }

    return {
      ticker,
      price: parseFloat(data['05. price']),
      change: parseFloat(data['09. change']),
      changePercent: parseFloat(data['10. change percent']?.replace('%', '')),
      previousClose: parseFloat(data['08. previous close']),
      market,
      source: 'alpha_vantage',
    };
  } catch {
    return null;
  }
}

async function getYahooQuote(ticker: string, market: 'BR' | 'US'): Promise<QuoteResult | null> {
  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        params: { interval: '1d', range: '2d' },
        headers: { 'User-Agent': YAHOO_USER_AGENT },
        timeout: 10000,
      },
    );

    const result = response.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose || meta?.previousClose;

    if (!price) return null;

    return {
      ticker,
      price,
      change: price - (previousClose || price),
      changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
      previousClose: previousClose || price,
      market,
      source: 'yahoo',
    };
  } catch {
    return null;
  }
}

/**
 * Get stock quote. Tries Alpha Vantage first, falls back to Yahoo Finance.
 */
export async function getQuote(ticker: string, market: 'BR' | 'US'): Promise<QuoteResult | null> {
  const alphaResult = await getAlphaVantageQuote(ticker, market);
  if (alphaResult) return alphaResult;

  console.info(`[market-data] Fallback Yahoo para cotação ${ticker}`);
  return getYahooQuote(ticker, market);
}

// ========== DAILY SERIES (for price sync cron) ==========

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function getAlphaDailySeries(ticker: string, market: 'BR' | 'US'): Promise<DailyBar[] | null> {
  if (!isAlphaAvailable()) return null;

  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    recordAlphaCall();
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'TIME_SERIES_DAILY', symbol, apikey: ALPHA_VANTAGE_KEY, outputsize: 'compact' },
      timeout: 15000,
    });

    if (response.data?.['Note'] || response.data?.['Information']) {
      console.warn('[market-data] Alpha Vantage rate limited on daily series');
      return null;
    }

    const daily = response.data?.['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!daily) return null;

    return Object.entries(daily)
      .map(([dateStr, bar]) => ({
        date: dateStr,
        open: parseFloat(bar['1. open']) || 0,
        high: parseFloat(bar['2. high']) || 0,
        low: parseFloat(bar['3. low']) || 0,
        close: parseFloat(bar['4. close']) || 0,
        volume: parseInt(bar['5. volume']) || 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return null;
  }
}

async function getYahooDailySeries(ticker: string, market: 'BR' | 'US'): Promise<DailyBar[] | null> {
  return getYahooSeriesWithRange(ticker, market, '5d');
}

/**
 * Get Yahoo daily series for the current month (range: 1mo).
 */
export async function getYahooMonthlySeries(ticker: string, market: 'BR' | 'US'): Promise<DailyBar[] | null> {
  return getYahooSeriesWithRange(ticker, market, '1mo');
}

async function getYahooSeriesWithRange(ticker: string, market: 'BR' | 'US', range: string): Promise<DailyBar[] | null> {
  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        params: { interval: '1d', range },
        headers: { 'User-Agent': YAHOO_USER_AGENT },
        timeout: 15000,
      },
    );

    const result = response.data?.chart?.result?.[0];
    // console.log(`[market-data] Yahoo series for ${ticker} (${market}) range ${range}:`, result);
    if (!result) return null;

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];
    if (!quotes || timestamps.length === 0) return null;

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const d = new Date(timestamps[i] * 1000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      bars.push({
        date,
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0,
      });
    }

    return bars.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return null;
  }
}

/**
 * Get daily price series. Tries Alpha Vantage first, falls back to Yahoo Finance.
 */
export async function getDailySeries(ticker: string, market: 'BR' | 'US'): Promise<DailyBar[] | null> {
  const alphaResult = await getAlphaDailySeries(ticker, market);
  if (alphaResult && alphaResult.length > 0) return alphaResult;

  console.info(`[market-data] Fallback Yahoo para série diária ${ticker}`);
  return getYahooDailySeries(ticker, market);
}

// ========== DIVIDENDS ==========

export interface DividendAnnouncement {
  ticker: string;
  exDate: string;
  paymentDate: string | null;
  declarationDate: string | null;
  amount: number;
  source: 'alpha_vantage' | 'yahoo';
}

async function getAlphaDividends(ticker: string, market: 'BR' | 'US'): Promise<DividendAnnouncement[] | null> {
  if (!isAlphaAvailable()) return null;

  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    recordAlphaCall();
    const response = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'DIVIDENDS', symbol, apikey: ALPHA_VANTAGE_KEY },
      timeout: 15000,
    });

    if (response.data?.['Note'] || response.data?.['Information']) {
      console.warn('[market-data] Alpha Vantage rate limited on dividends');
      return null;
    }

    const data = response.data?.data as Array<{
      ex_dividend_date: string;
      payment_date: string;
      declaration_date: string;
      amount: string;
    }> | undefined;

    if (!data || data.length === 0) return null;

    return data.map((d) => ({
      ticker,
      exDate: d.ex_dividend_date,
      paymentDate: d.payment_date && d.payment_date !== 'None' ? d.payment_date : null,
      declarationDate: d.declaration_date && d.declaration_date !== 'None' ? d.declaration_date : null,
      amount: parseFloat(d.amount) || 0,
      source: 'alpha_vantage' as const,
    }));
  } catch {
    return null;
  }
}

async function getYahooDividends(ticker: string, market: 'BR' | 'US'): Promise<DividendAnnouncement[] | null> {
  try {
    const symbol = market === 'BR' ? `${ticker}.SA` : ticker;
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
      {
        params: { interval: '1d', range: '2y', events: 'dividends' },
        headers: { 'User-Agent': YAHOO_USER_AGENT },
        timeout: 15000,
      },
    );

    const result = response.data?.chart?.result?.[0];
    if (!result) return null;

    const dividends = result.events?.dividends as Record<string, { amount: number; date: number }> | undefined;
    if (!dividends) return null;

    return Object.values(dividends).map((d) => {
      const dateObj = new Date(d.date * 1000);
      const exDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      return {
        ticker,
        exDate,
        paymentDate: null, // Yahoo doesn't provide payment date
        declarationDate: null,
        amount: d.amount,
        source: 'yahoo' as const,
      };
    }).sort((a, b) => b.exDate.localeCompare(a.exDate));
  } catch {
    return null;
  }
}

/**
 * Get dividend announcements. Tries Alpha Vantage first, falls back to Yahoo Finance.
 */
export async function getDividends(ticker: string, market: 'BR' | 'US'): Promise<DividendAnnouncement[] | null> {
  const alphaResult = await getAlphaDividends(ticker, market);
  if (alphaResult && alphaResult.length > 0) return alphaResult;

  console.info(`[market-data] Fallback Yahoo para dividendos ${ticker}`);
  return getYahooDividends(ticker, market);
}

// ========== UTILITIES ==========

export function detectMarket(ticker: string): 'BR' | 'US' {
  if (/\d+$/.test(ticker) && ticker.length <= 6) return 'BR';
  return 'US';
}

export function getAlphaUsageStats() {
  checkAlphaReset();
  return { callsToday: alphaCallsToday, limit: ALPHA_DAILY_LIMIT, remaining: ALPHA_DAILY_LIMIT - alphaCallsToday };
}
