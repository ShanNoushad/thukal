'use client';

import { useState } from 'react';
import { money } from '@/lib/clientApi';

function percentOff(fake, real) {
  if (!fake || Number(fake) <= real) return 0;
  return Math.round(((Number(fake) - real) / Number(fake)) * 100);
}

export default function ProductCard({ product, onEdit, onDelete }) {
  const [imgFailed, setImgFailed] = useState(false);

  // new products store `images` (array); old ones stored `imageUrl`
  const photo = product.images?.[0] || product.imageUrl || '';

  // new products have `variants`; old single-price ones have top-level prices
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;

  let cheapest = null;
  if (hasVariants) {
    cheapest = variants.reduce((a, b) => (b.sellingPrice < a.sellingPrice ? b : a));
  }

  const price = hasVariants ? cheapest.sellingPrice : product.sellingPrice;
  const fake = hasVariants ? cheapest.fakePrice : product.fakePrice;
  const hasRange = hasVariants && variants.some((v) => v.sellingPrice !== price);
  const off = percentOff(fake, price);

  const totalStock = hasVariants
    ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : Number(product.stock) || 0;

  return (
    <div className="card product-card">
      <div className="product-photo">
        {photo && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="image-preview"
            src={photo}
            alt={product.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="no-photo muted">No photo</div>
        )}
        {product.status === 'draft' && <span className="badge">Draft</span>}
      </div>

      <div className="product-info">
        <h3>{product.name}</h3>
        <p className="muted">{product.category}</p>

        {price != null && (
          <p className="shown-price">
            {hasRange && <span className="muted">from </span>}
            {fake != null && Number(fake) > price && <s className="fake">{money(Number(fake))}</s>}{' '}
            <b className="real">{money(price)}</b>{' '}
            {off > 0 && <span className="off">{off}% off</span>}
          </p>
        )}

        {hasVariants && (
          <p className="muted">
            {variants.map((v) => v.label).join(', ')}
          </p>
        )}

        <p className="muted">Stock: {totalStock}</p>
      </div>

      <div className="row">
        <button type="button" className="btn ghost grow" onClick={() => onEdit(product)}>
          Edit
        </button>
        <button type="button" className="btn ghost" onClick={() => onDelete(product)}>
          Delete
        </button>
      </div>
    </div>
  );
}