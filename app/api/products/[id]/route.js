import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { readProductForm, parseProductFields, uploadImages, COLLECTION } from '@/lib/products';
import { deleteImage } from '@/lib/cloudinary';
import { getDb } from '@/lib/firebaseAdmin';
import { authenticate } from '@/lib/auth';
import { HttpError } from '@/lib/http';

function fail(err) {
  const status = err instanceof HttpError ? err.status : 500;
  return NextResponse.json({ error: err.message || 'Server error' }, { status });
}

function photoIds(d) {
  return d.imagePublicIds ?? (d.imagePublicId ? [d.imagePublicId] : []);
}

export async function PUT(request, { params }) {
  try {
    await authenticate(request);
    const db = getDb();
    const { id } = await params;

    const ref = db.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Product not found');

    const { fields, imageFiles } = await readProductForm(request);
    const data = parseProductFields(fields);
    const update = { ...data, updatedAt: FieldValue.serverTimestamp() };

    // only replace photos when new ones were picked
    let oldIds = [];
    if (imageFiles.length > 0) {
      const uploaded = await uploadImages(imageFiles);
      update.images = uploaded.images;
      update.imagePublicIds = uploaded.imagePublicIds;
      oldIds = photoIds(snap.data());
    }

    await ref.update(update);
    await Promise.all(oldIds.map((pid) => deleteImage(pid)));
    return NextResponse.json({ id });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    await authenticate(request);
    const { id } = await params;

    const ref = getDb().collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Product not found');

    await ref.delete();
    await Promise.all(photoIds(snap.data()).map((pid) => deleteImage(pid)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}