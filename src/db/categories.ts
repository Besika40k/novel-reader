import { db } from './db';

export async function addCategory(name: string): Promise<void> {
  const last = await db.categories.orderBy('order').last();
  await db.categories.add({ name, order: (last?.order ?? -1) + 1 });
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await db.categories.update(id, { name });
}

/** Deletes a category; its novels move to the first remaining one. The last category stays. */
export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.novels, async () => {
    const fallback = (await db.categories.orderBy('order').toArray()).find((c) => c.id !== id);
    if (!fallback) return;
    await db.novels.filter((novel) => novel.categoryId === id).modify({ categoryId: fallback.id });
    await db.categories.delete(id);
  });
}
