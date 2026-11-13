import { calculatePricing } from './pricing';
import { uploadImage } from './cloudinary';
import { HttpError } from './http';

export const COLLECTION = 'products';
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, same as the form

// Turn multipart form data into { fields, imageFiles }
export async function readProductForm(request) {
  const form = await request.formData();
  const fields = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') fields[key] = value;
  }
  const imageFiles = form
    .getAll('images')
    .filter((f) => f && typeof f !== 'string' && f.size > 0)
    .slice(0, MAX_IMAGES);
  return { fields, imageFiles };
}

export function validateImage(file) {
  if (!file.type.startsWith('image/')) throw new HttpError(400, 'Only image files are allowed');
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Image is too large (max 5 MB)');
}

// validate, convert to buffers, upload; returns URLs plus ids for later deletion
export async function uploadImages(files) {
  files.forEach(validateImage);
  const results = await Promise.all(
    files.map(async (f) => uploadImage(Buffer.from(await f.arrayBuffer())))
  );
  return {
    images: results.map((r) => r.url),
    imagePublicIds: results.map((r) => r.publicId),
  };
}

function isValidUrl(v) {
  if (!v) return true;
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

export function parseProductFields(fields) {
  const name = String(fields.name || '').trim();
  if (!name) throw new HttpError(400, 'Product name is required');
  if (name.length > 120) throw new HttpError(400, 'Product name is too long (max 120 characters)');

  const description = String(fields.description || '').trim().slice(0, 2000);
  const category = String(fields.category || 'Other').trim().slice(0, 50);
  const productLink = String(fields.productLink || '').trim();
  if (!isValidUrl(productLink)) {
    throw new HttpError(400, 'Product link must start with http:// or https://');
  }
  const status = fields.status === 'draft' ? 'draft' : 'active';

  let rawVariants;
  try {
    rawVariants = JSON.parse(fields.variants || '[]');
  } catch {
    throw new HttpError(400, 'Variants data is invalid');
  }
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw new HttpError(400, 'Add at least one size or pack');
  }

  const marginType = fields.marginType;
  const marginValue = fields.marginValue;
  const seen = new Set();

  const variants = rawVariants.map((v) => {
    const label = String(v.label || '').trim();
    if (!label) throw new HttpError(400, 'Every size or pack needs a name');
    if (seen.has(label.toLowerCase())) throw new HttpError(400, `"${label}" is added twice`);
    seen.add(label.toLowerCase());

    let pricing;
    try {
      pricing = calculatePricing({
        costPrice: v.costPrice,
        marginType,
        marginValue,
        offerType: 'none',
        offerValue: 0,
      });
    } catch (err) {
      throw new HttpError(400, `${label}: ${err.message}`);
    }

    const fakePrice = v.fakePrice == null ? null : Number(v.fakePrice);
    if (fakePrice !== null && (!Number.isFinite(fakePrice) || fakePrice <= pricing.sellingPrice)) {
      throw new HttpError(400, `${label}: fake price must be higher than the real price`);
    }

    return {
      ...pricing, // sellingPrice, profitPerUnit, etc.
      label,
      type: ['size', 'pack', 'free'].includes(v.type) ? v.type : 'size',
      packQty: Math.max(1, Math.floor(Number(v.packQty) || 1)),
      costPrice: Number(v.costPrice),
      fakePrice,
      stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
    };
  });

  return {
    name,
    description,
    category,
    productLink,
    status,
    marginType,
    marginValue: Number(marginValue) || 0,
    variants,
  };
}

export function serialize(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    ...d,
    // old single-image products still show up
    images: d.images ?? (d.imageUrl ? [d.imageUrl] : []),
    createdAt: d.createdAt?.toMillis?.() ?? null,
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  };
}