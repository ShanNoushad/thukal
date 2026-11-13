'use client';

import { useCallback, useEffect, useState } from 'react';
import ProductForm, { DEFAULT_SIZES, DEFAULT_PACKS } from './ProductForm';
import ProductCard from './ProductCard';
import { apiCall } from '@/lib/clientApi';

export default function Dashboard({ session, onLogout }) {
  const [tab, setTab] = useState('products'); // 'products' | 'form'
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0); // changing the key remounts (resets) the form
  const [presets, setPresets] = useState({ sizes: DEFAULT_SIZES, packs: DEFAULT_PACKS });

  const call = useCallback(
    (path, options) => apiCall(session, onLogout, path, options),
    [session, onLogout]
  );

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await call('/api/products'));
      setListError('');
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [call]);

  useEffect(() => {
    loadProducts();
    call('/api/presets').then(setPresets).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePresets(next) {
    setPresets(next); // update the screen at once
    try {
      await call('/api/presets', { method: 'PUT', json: next });
    } catch (err) {
      alert(`Could not save your size list: ${err.message}`);
    }
  }

  function resetForm() {
    setEditing(null);
    setFormKey((k) => k + 1);
  }

  function openProducts() {
    setTab('products');
  }

  function openAdd() {
    if (editing) resetForm(); // leaving edit mode -> fresh empty form
    setTab('form');
  }

  function startEdit(product) {
    setEditing(product);
    setFormKey((k) => k + 1);
    setTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelForm() {
    resetForm();
    setTab('products');
  }

  async function save(formData) {
    await call(editing ? `/api/products/${editing.id}` : '/api/products', {
      method: editing ? 'PUT' : 'POST',
      body: formData,
    });
    resetForm();
    await loadProducts();
    setTab('products');
  }

  async function remove(product) {
    if (!confirm(`Delete "${product.name}"?`)) return;
    try {
      await call(`/api/products/${product.id}`, { method: 'DELETE' });
      if (editing?.id === product.id) resetForm();
      await loadProducts();
    } catch (err) {
      alert(err.message);
    }
  }

  const q = search.trim().toLowerCase();
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Product Manager</h1>
        <div className="topbar-right">
          <span className="muted">{session.label}</span>
          <button className="btn ghost" onClick={() => onLogout()}>Logout</button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar" aria-label="Main">
          <button
            type="button"
            className={`side-tab${tab === 'products' ? ' active' : ''}`}
            onClick={openProducts}
          >
            <span className="side-icon">📦</span>
            <span>Products</span>
            {loaded && <span className="side-count">{products.length}</span>}
          </button>

          <button
            type="button"
            className={`side-tab${tab === 'form' ? ' active' : ''}`}
            onClick={openAdd}
          >
            <span className="side-icon">{editing ? '✏️' : '➕'}</span>
            <span>{editing ? 'Edit product' : 'Add product'}</span>
          </button>
        </nav>

        <main className="content">
          {tab === 'products' && (
            <div className="list-wrap">
              <div className="list-head">
                <h2>
                  Products <span className="muted">{products.length ? `(${shown.length})` : ''}</span>
                </h2>
                <input
                  type="search"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {listError && <p className="error">{listError}</p>}

              <div className="grid">
                {shown.map((p) => (
                  <ProductCard key={p.id} product={p} onEdit={startEdit} onDelete={remove} />
                ))}
              </div>

              {loaded && !listError && products.length === 0 && (
                <div className="empty">
                  <p className="muted">No products yet. Add your first one.</p>
                  <button className="btn primary" onClick={openAdd}>+ Add product</button>
                </div>
              )}

              {loaded && products.length > 0 && shown.length === 0 && (
                <p className="muted">No products match "{search}".</p>
              )}
            </div>
          )}

          {tab === 'form' && (
            <ProductForm
              key={formKey}
              editing={editing}
              onSubmit={save}
              onCancel={cancelForm}
              presets={presets}
              onSavePresets={savePresets}
              previewPrice={(input) => call('/api/products/preview-price', { method: 'POST', json: input })}
            />
          )}
        </main>
      </div>
    </div>
  );
}