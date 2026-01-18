import type { CacheStore } from "@csv/core";
import type { Db } from "@csv/db";
import { sql } from "kysely";

export class PostgresCacheStore implements CacheStore {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db
      .selectFrom("cache_store")
      .select(["value", "expiresAt"])
      .where("key", "=", key)
      .executeTakeFirst();

    if (!row) return null;
    if (row.expiresAt <= new Date()) {
      await this.db.deleteFrom("cache_store").where("key", "=", key).execute();
      return null;
    }

    if (typeof row.value === "string") {
      return row.value;
    }
    return JSON.stringify(row.value);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.db
      .insertInto("cache_store")
      .values({
        key,
        value: sql`to_jsonb(${value})`,
        expiresAt
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          value: sql`to_jsonb(${value})`,
          expiresAt,
          updatedAt: sql`now()`
        })
      )
      .execute();
  }
}

export async function deleteExpiredCacheEntries(db: Db): Promise<number> {
  const result = await db
    .deleteFrom("cache_store")
    .where("expiresAt", "<=", sql`now()`)
    .execute();

  let deleted = 0;
  for (const item of result as Array<{ numDeletedRows?: bigint }>) {
    if (item?.numDeletedRows !== undefined) {
      const value = Number(item.numDeletedRows);
      if (!Number.isNaN(value)) {
        deleted += value;
      }
    }
  }

  return deleted;
}
