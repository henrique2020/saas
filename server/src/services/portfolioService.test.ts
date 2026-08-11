import { describe, it, expect } from 'vitest';

describe('Portfolio Math & Position Calculation Safeguards', () => {
  it('calculates average price and position correctly for buy transactions', () => {
    let quantity = 0;
    let totalInvested = 0;

    // Buy 10 shares @ R$ 10
    const tx1 = { qty: 10, price: 10 };
    totalInvested += tx1.qty * tx1.price;
    quantity += tx1.qty;
    let avgPrice = totalInvested / quantity;

    expect(quantity).toBe(10);
    expect(totalInvested).toBe(100);
    expect(avgPrice).toBe(10);

    // Buy 10 shares @ R$ 20
    const tx2 = { qty: 10, price: 20 };
    totalInvested += tx2.qty * tx2.price;
    quantity += tx2.qty;
    avgPrice = totalInvested / quantity;

    expect(quantity).toBe(20);
    expect(totalInvested).toBe(300);
    expect(avgPrice).toBe(15);
  });

  it('handles sell transactions proportionally and guards against overselling', () => {
    let quantity = 20;
    let totalInvested = 300; // avg price 15

    // Sell 10 shares @ R$ 25
    const sellQty = 10;
    const sellRatio = Math.min(1, sellQty / quantity);
    totalInvested -= totalInvested * sellRatio;
    quantity = Math.max(0, quantity - sellQty);
    const avgPrice = quantity > 0 ? totalInvested / quantity : 0;

    expect(quantity).toBe(10);
    expect(totalInvested).toBe(150);
    expect(avgPrice).toBe(15);

    // Try overselling 20 shares when only 10 are held
    const overSellQty = 20;
    const overSellRatio = Math.min(1, overSellQty / quantity);
    totalInvested -= totalInvested * overSellRatio;
    quantity = Math.max(0, quantity - overSellQty);
    const finalAvgPrice = quantity > 0 ? totalInvested / quantity : 0;

    expect(quantity).toBe(0);
    expect(totalInvested).toBe(0);
    expect(finalAvgPrice).toBe(0);
  });
});
