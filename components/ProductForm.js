'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/clientApi';

const CATEGORIES = ['Trousers', 'Jeans', 'Shirts', 'T-Shirts', 'Kurtas', 'Dresses', 'Innerwear', 'Kids', 'Other'];
export const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
export const DEFAULT_PACKS = [2, 3, 4, 5];

function isValidUrl(v) {
  if (!v) return true;
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

function percentOff(fake, real) {
  if (!fake || Number(fake) <= real) return 0;
  return Math.round(((Number(fake) - real) / Number(fake)) * 100);
}

// works out what a row is from its name
function kindOf(label) {
  const t = label.trim();
  const m = t.match(/^pack of\s*(\d+)$/i);
  if (m) return { type: 'pack', packQty: Number(m[1]) };
  if (/^free size$/i.test(t)) return { type: 'free', packQty: 1 };
  return { type: 'size', packQty: 1 };
}

export default function ProductForm({ editing, onSubmit, onCancel, previewPrice, presets, onSavePresets }) {
  const nextId = useRef(1);
  const row = (r = {}) => ({
    id: nextId.current++,
    label: r.label ?? '',
    costPrice: r.costPrice ?? '',
    fakePrice: r.fakePrice ?? '',
    stock: r.stock ?? 0,
  });

  const sizeList = presets?.sizes ?? DEFAULT_SIZES;
  const packList = presets?.packs ?? DEFAULT_PACKS;

  // 1. Basic details
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [productLink, setProductLink] = useState(editing?.productLink ?? '');

  // 2. Photos
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // 3. Sizes, packs and price
  const [rows, setRows] = useState(() =>
    editing?.variants?.length ? editing.variants.map(row) : [row()]
  );
  const [samePrice, setSamePrice] = useState(() => {
    const v = editing?.variants;
    if (!v?.length) return true; // new product: same price by default
    return v.every(
      (x) => x.costPrice === v[0].costPrice && (x.fakePrice ?? '') === (v[0].fakePrice ?? '')
    );
  });
  const [shared, setShared] = useState(() => ({
    costPrice: editing?.variants?.[0]?.costPrice ?? '',
    fakePrice: editing?.variants?.[0]?.fakePrice ?? '',
  }));
  const [newSize, setNewSize] = useState('');
  const [newPack, setNewPack] = useState('');

  // 4. Margin
  const [marginType, setMarginType] = useState(editing?.marginType ?? 'fixed');
  const [marginValue, setMarginValue] = useState(editing?.marginValue ?? 0);

  // 5. Publish
  const [status, setStatus] = useState(editing?.status ?? 'active');

  const [priceMap, setPriceMap] = useState({}); // { [costPrice]: result | { error } }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const existingImages = editing?.images ?? (editing?.imageUrl ? [editing.imageUrl] : []);

  // the cost / fake price a row really uses
  const eff = (r) => (samePrice ? shared : r);
  const priceFor = (r) => priceMap[String(eff(r).costPrice)];

  // ---------- photos ----------
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function pickPhotos(e) {
    const picked = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024
    );
    e.target.value = '';
    setFiles((old) => [...old, ...picked].slice(0, 5));
  }

  // ---------- rows ----------
  const updateRow = (id, patch) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((l) => (l.length > 1 ? l.filter((r) => r.id !== id) : l));

  function addRow(label = '') {
    if (label && rows.some((r) => r.label.toLowerCase() === label.toLowerCase())) return;
    const first = rows[0];
    const blank = rows.length === 1 && !first.label && (samePrice || first.costPrice === '');
    if (blank && label) return updateRow(first.id, { label });
    const last = rows[rows.length - 1];
    setRows((l) => [...l, row({ label, costPrice: last?.costPrice ?? '', fakePrice: last?.fakePrice ?? '' })]);
  }

  function toggleSame(on) {
    if (on) {
      const first = rows[0];
      if (first.costPrice !== '' || first.fakePrice !== '') {
        setShared({ costPrice: first.costPrice, fakePrice: first.fakePrice });
      }
    } else {
      // keep the shared price on every row so you can edit each one
      setRows((l) => l.map((r) => ({ ...r, costPrice: shared.costPrice, fakePrice: shared.fakePrice })));
    }
    setSamePrice(on);
  }

  // ---------- custom sizes and packs ----------
  function addCustomSize() {
    const s = newSize.trim();
    if (!s) return;
    if (!sizeList.some((x) => x.toLowerCase() === s.toLowerCase())) {
      onSavePresets?.({ sizes: [...sizeList, s], packs: packList });
    }
    addRow(s);
    setNewSize('');
    setError('');
  }

  function addCustomPack() {
    const q = Math.floor(Number(newPack));
    if (!q || q < 2) return setError('A pack must have 2 or more pieces');
    if (!packList.includes(q)) {
      onSavePresets?.({ sizes: sizeList, packs: [...packList, q].sort((a, b) => a - b) });
    }
    addRow(`Pack of ${q}`);
    setNewPack('');
    setError('');
  }

  function removePreset(kind, value) {
    onSavePresets?.(
      kind === 'size'
        ? { sizes: sizeList.filter((x) => x !== value), packs: packList }
        : { sizes: sizeList, packs: packList.filter((x) => x !== value) }
    );
  }

  // ---------- live prices from the server (one call per different cost) ----------
  const costs = [...new Set(rows.map((r) => String(eff(r).costPrice)).filter((c) => c !== ''))];
  const key = JSON.stringify([costs, marginType, marginValue]);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const out = await Promise.all(
        costs.map(async (c) => {
          try {
            const p = await previewPrice({
              costPrice: c,
              marginType,
              marginValue,
              offerType: 'none',
              offerValue: 0,
            });
            return [c, p];
          } catch (err) {
            return [c, { error: err.message }];
          }
        })
      );
      if (!cancelled) setPriceMap(Object.fromEntries(out));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ---------- validation and submit ----------
  // rows that will really be saved
  function usableRows() {
    const isEmpty = (r) => !r.label.trim() && (samePrice || r.costPrice === '') && !Number(r.stock);
    let list = rows.filter((r) => !isEmpty(r));
    if (list.length === 0) list = [rows[0]];
    if (list.length === 1 && !list[0].label.trim()) list = [{ ...list[0], label: 'Free size' }];
    return list;
  }

  function validate() {
    if (!name.trim()) return 'Enter the product name';
    if (!isValidUrl(productLink.trim())) return 'Product link must start with http:// or https://';
    const seen = new Set();
    for (const [i, r] of usableRows().entries()) {
      const label = r.label.trim().toLowerCase();
      if (!label) return `Row ${i + 1}: enter a size or pack name`;
      if (seen.has(label)) return `"${r.label}" is added twice`;
      seen.add(label);

      const { costPrice, fakePrice } = eff(r);
      const parsedCost =
        costPrice === '' || costPrice === null || costPrice === undefined
          ? NaN
          : Number(costPrice);

      if (!Number.isFinite(parsedCost) || parsedCost < 0) {
        return `${r.label || 'Row ' + (i + 1)}: Cost price must be a valid number`;
      }
      if (!Number.isInteger(Number(r.stock)) || Number(r.stock) < 0) return `${r.label}: stock must be a whole number`;

      const p = priceFor(r);
      if (p?.error) return `${r.label}: ${p.error}`;
      if (fakePrice !== '') {
        if (Number(fakePrice) <= 0) return `${r.label}: fake price must be above 0`;
        if (p && Number(fakePrice) <= p.sellingPrice)
          return `${r.label}: fake price must be higher than the real price (${money(p.sellingPrice)})`;
      }
    }
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setError('');

    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('category', category);
    fd.append('description', description);
    fd.append('productLink', productLink.trim());
    fd.append('marginType', marginType);
    fd.append('marginValue', marginValue || 0);
    fd.append('offerType', 'none'); // offers removed; kept so an older backend still works
    fd.append('offerValue', 0);
    fd.append('status', status);
    fd.append(
      'variants',
      JSON.stringify(
        usableRows().map((r) => {
          const { costPrice, fakePrice } = eff(r);
          const label = r.label.trim();
          return {
            label,
            ...kindOf(label), // type: 'size' | 'pack' | 'free', plus packQty
            costPrice: Number(costPrice),
            fakePrice: fakePrice === '' ? null : Number(fakePrice),
            stock: Number(r.stock) || 0,
          };
        })
      )
    );
    files.forEach((f) => fd.append('images', f));

    setSaving(true);
    try {
      await onSubmit(fd); // parent resets the form (remount) on success
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const sharedPrice = priceMap[String(shared.costPrice)];

  return (
    <form className="product-page" onSubmit={submit}>
      <h1>{editing ? 'Edit product' : 'Add product'}</h1>

      {/* SECTION 1 */}
      <section className="card section">
        <h2><span>1</span> Basic details</h2>
        <label>
          Product name *
          <input type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Description
          <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Real product link (optional)
          <input type="url" placeholder="https://..." value={productLink} onChange={(e) => setProductLink(e.target.value)} />
        </label>
      </section>

      {/* SECTION 2 */}
      <section className="card section">
        <h2><span>2</span> Photos</h2>
        <input type="file" accept="image/*" multiple onChange={pickPhotos} />
        <small>Up to 5 photos, 5 MB each.</small>
        <div className="image-grid">
          {files.length === 0 &&
            existingImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src + i} className="image-preview" src={src} alt="Current" />
            ))}
          {previews.map((src, i) => (
            <div key={src} className="image-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="image-preview" src={src} alt="New" />
              <button type="button" className="btn ghost" onClick={() => setFiles((f) => f.filter((_, x) => x !== i))}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="card section">
        <h2><span>3</span> Sizes, packs and price</h2>

        <label className="check">
          <input type="checkbox" checked={samePrice} onChange={(e) => toggleSame(e.target.checked)} />
          Same price for all sizes and packs
        </label>
        <p className="hint">No sizes? Leave the table empty and it saves as "Free size".</p>

        {samePrice && (
          <div className="same-box">
            <div className="row">
              <label className="grow">
                Cost price (what it costs you)
                <input
                  type="number" min="0" step="0.01" value={shared.costPrice}
                  onChange={(e) => setShared((s) => ({ ...s, costPrice: e.target.value }))}
                />
              </label>
              <label className="grow">
                Fake price (shown cut)
                <input
                  type="number" min="0" step="0.01" placeholder="optional" value={shared.fakePrice}
                  onChange={(e) => setShared((s) => ({ ...s, fakePrice: e.target.value }))}
                />
              </label>
            </div>
            {sharedPrice && !sharedPrice.error && (
              <p className="shown-price">
                Customer sees:{' '}
                {shared.fakePrice !== '' && Number(shared.fakePrice) > sharedPrice.sellingPrice && (
                  <s className="fake">{money(Number(shared.fakePrice))}</s>
                )}{' '}
                <b className="real">{money(sharedPrice.sellingPrice)}</b>{' '}
                {percentOff(shared.fakePrice, sharedPrice.sellingPrice) > 0 && (
                  <span className="off">{percentOff(shared.fakePrice, sharedPrice.sellingPrice)}% off</span>
                )}
                <span className="muted"> · Profit {money(sharedPrice.profitPerUnit)}</span>
              </p>
            )}
          </div>
        )}

        <div className="chips">
          {sizeList.map((s) => (
            <span key={s} className="chip">
              <button type="button" className="btn ghost" onClick={() => addRow(s)}>{s}</button>
              {!DEFAULT_SIZES.includes(s) && (
                <button type="button" className="chip-x" aria-label={`Remove ${s} from my list`}
                  onClick={() => removePreset('size', s)}>×</button>
              )}
            </span>
          ))}
          {packList.map((q) => (
            <span key={q} className="chip">
              <button type="button" className="btn ghost" onClick={() => addRow(`Pack of ${q}`)}>Pack of {q}</button>
              {!DEFAULT_PACKS.includes(q) && (
                <button type="button" className="chip-x" aria-label={`Remove pack of ${q} from my list`}
                  onClick={() => removePreset('pack', q)}>×</button>
              )}
            </span>
          ))}
        </div>

        <div className="row">
          <label className="grow">
            Not in the list? New size
            <input type="text" maxLength={20} placeholder="e.g. 34, 3XL, 6-7 yrs" value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }} />
          </label>
          <button type="button" className="btn ghost" onClick={addCustomSize}>+ Add size</button>
        </div>
        <div className="row">
          <label className="grow">
            New pack (pieces)
            <input type="number" min="2" step="1" placeholder="e.g. 6" value={newPack}
              onChange={(e) => setNewPack(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomPack(); } }} />
          </label>
          <button type="button" className="btn ghost" onClick={addCustomPack}>+ Add pack</button>
        </div>

        <div className="table-wrap">
          <table className="variant-table">
            <thead>
              <tr>
                <th>Size / Pack</th>
                {!samePrice && <th>Cost</th>}
                {!samePrice && <th>Fake price</th>}
                <th>Stock</th>
                <th>Customer sees</th>
                <th>Profit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = priceFor(r);
                const ok = p && !p.error;
                const fake = eff(r).fakePrice;
                const showFake = ok && fake !== '' && Number(fake) > p.sellingPrice;
                return (
                  <tr key={r.id}>
                    <td>
                      <input type="text" maxLength={30} placeholder="M, 32, Pack of 3" value={r.label}
                        onChange={(e) => updateRow(r.id, { label: e.target.value })} />
                    </td>
                    {!samePrice && (
                      <td>
                        <input type="number" min="0" step="0.01" value={r.costPrice}
                          onChange={(e) => updateRow(r.id, { costPrice: e.target.value })} />
                      </td>
                    )}
                    {!samePrice && (
                      <td>
                        <input type="number" min="0" step="0.01" placeholder="optional" value={r.fakePrice}
                          onChange={(e) => updateRow(r.id, { fakePrice: e.target.value })} />
                      </td>
                    )}
                    <td>
                      <input type="number" min="0" step="1" value={r.stock}
                        onChange={(e) => updateRow(r.id, { stock: e.target.value })} />
                    </td>
                    <td>
                      {ok ? (
                        <>
                          {showFake && <s className="fake">{money(Number(fake))}</s>}{' '}
                          <b className="real">{money(p.sellingPrice)}</b>
                        </>
                      ) : '-'}
                    </td>
                    <td className={ok && p.profitPerUnit < 0 ? 'loss' : ''}><b>{ok ? money(p.profitPerUnit) : '-'}</b></td>
                    <td>
                      {rows.length > 1 && (
                        <button type="button" className="btn ghost" onClick={() => removeRow(r.id)}>✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button type="button" className="btn ghost" onClick={() => addRow()}>
          + Add another row
        </button>
      </section>

      {/* SECTION 4 */}
      <section className="card section">
        <h2><span>4</span> Margin</h2>
        <p className="hint">Real price = cost price + margin. It applies to every size and pack.</p>
        <div className="row">
          <label className="grow">
            Margin type
            <select value={marginType} onChange={(e) => setMarginType(e.target.value)}>
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percent %</option>
            </select>
          </label>
          <label className="grow">
            Margin
            <input type="number" min="0" step="0.01" value={marginValue} onChange={(e) => setMarginValue(e.target.value)} />
          </label>
        </div>
        {Object.values(priceMap).some((p) => p?.sellingBelowCost) && (
          <p className="error">Warning: some prices are below your cost</p>
        )}
      </section>

      {/* SECTION 5 */}
      <section className="card section">
        <h2><span>5</span> Publish</h2>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active (visible to customers)</option>
            <option value="draft">Draft (hidden)</option>
          </select>
        </label>
      </section>

      <div className="save-bar">
        <p className="error" role="alert">{error}</p>
        <div className="row">
          <button type="submit" className="btn primary grow" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add product'}
          </button>
          {editing && (
            <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          )}
        </div>
      </div>
    </form>
  );
}