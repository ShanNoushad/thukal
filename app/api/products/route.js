import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  readProductForm,
  parseProductFields,
  uploadImages,
  serialize,
  COLLECTION,
} from '@/lib/products';
import { getDb } from '@/lib/firebaseAdmin';
import { authenticate } from '@/lib/auth';
import { HttpError } from '@/lib/http';

function fail(err) {
  const status = err instanceof HttpError ? err.status : 500;
  return NextResponse.json({ error: err.message || 'Server error' }, { status });
}

export async function GET(request) {
  try {
    await authenticate(request);
    const snap = await getDb().collection(COLLECTION).orderBy('createdAt', 'desc').get();
    return NextResponse.json(snap.docs.map(serialize));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  try {
    await authenticate(request);
    const db = getDb();

    const { fields, imageFiles } = await readProductForm(request);
    const data = parseProductFields(fields);
    const { images, imagePublicIds } = await uploadImages(imageFiles);

    const ref = await db.collection(COLLECTION).add({
      ...data,
      images,
      imagePublicIds,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}