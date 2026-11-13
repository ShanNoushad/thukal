// Pricing logic: sellingPrice = costPrice + margin, then an optional offer on top.
//
// costPrice   : what the product actually costs you
// marginType  : 'fixed'   -> margin is an amount (e.g. 50)
//               'percent' -> margin is a % of costPrice (e.g. 20 = 20%)
// offerType   : 'none'    -> no offer
//               'percent' -> offerValue is % discount off sellingPrice
//               'price'   -> offerValue is the final offer price you want to show

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function toNumber(value, field) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(n)) {
    throw new Error(`${field} must be a valid number`);
  }
  return n;
}

export function calculatePricing(input) {
  const costPrice = toNumber(input.costPrice, 'Cost price');
  if (costPrice < 0) throw new Error('Cost price cannot be negative');

  const marginType = input.marginType === 'percent' ? 'percent' : 'fixed';
  const marginValue = toNumber(input.marginValue ?? 0, 'Margin');
  if (marginValue < 0) throw new Error('Margin cannot be negative');
  if (marginType === 'percent' && marginValue > 1000) {
    throw new Error('Margin percent looks too high (max 1000)');
  }

  const marginAmount = round2(
    marginType === 'percent' ? (costPrice * marginValue) / 100 : marginValue
  );

  // price = price + margin
  const sellingPrice = round2(costPrice + marginAmount);

  const offerType = ['percent', 'price'].includes(input.offerType) ? input.offerType : 'none';
  let offerValue = 0;
  let offerPrice = null;

  if (offerType !== 'none') {
    offerValue = toNumber(input.offerValue, 'Offer value');
    if (offerValue < 0) throw new Error('Offer value cannot be negative');

    if (offerType === 'percent') {
      if (offerValue > 100) throw new Error('Offer percent cannot be more than 100');
      offerPrice = round2(sellingPrice - (sellingPrice * offerValue) / 100);
    } else {
      if (offerValue > sellingPrice) {
        throw new Error('Offer price cannot be higher than the selling price');
      }
      offerPrice = round2(offerValue);
    }
  }

  const finalPrice = offerPrice !== null ? offerPrice : sellingPrice;
  const profitPerUnit = round2(finalPrice - costPrice);

  return {
    costPrice: round2(costPrice),
    marginType,
    marginValue: round2(marginValue),
    marginAmount,
    sellingPrice,
    offerType,
    offerValue: round2(offerValue),
    offerPrice,
    finalPrice,
    profitPerUnit,
    sellingBelowCost: finalPrice < costPrice,
  };
}
