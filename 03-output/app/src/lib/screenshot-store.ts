import type { SupabaseClient } from "@supabase/supabase-js";
import { BlobSASPermissions, BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { SCREENSHOT_BUCKET } from "@/lib/console";

/**
 * 유료 시트 스크린샷 저장소 (비공개). ADR-0015 2단계 — Azure Blob 연결 문자열
 * (AZURE_STORAGE_CONNECTION_STRING)이 있으면 Blob 컨테이너, 없으면 기존 Supabase Storage.
 * 객체 경로(`screenshotObjectPath`)와 DB 에 저장되는 값은 두 저장소에서 같다.
 */
export interface ScreenshotStore {
  upload(path: string, body: Blob, contentType: string): Promise<{ error: string | null }>;
  /** path → 기간 한정 읽기 URL (실패한 path 는 빠진다) */
  signedUrls(paths: string[], ttlSeconds: number): Promise<Map<string, string>>;
  remove(paths: string[]): Promise<{ error: string | null }>;
}

function blobContainer(): ContainerClient | null {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) return null;
  return BlobServiceClient.fromConnectionString(conn).getContainerClient(SCREENSHOT_BUCKET);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function blobScreenshotStore(container: ContainerClient): ScreenshotStore {
  return {
    async upload(path, body, contentType) {
      try {
        await container
          .getBlockBlobClient(path)
          .uploadData(Buffer.from(await body.arrayBuffer()), { blobHTTPHeaders: { blobContentType: contentType } });
        return { error: null };
      } catch (err) {
        return { error: message(err) };
      }
    },
    async signedUrls(paths, ttlSeconds) {
      const out = new Map<string, string>();
      const expiresOn = new Date(Date.now() + ttlSeconds * 1000);
      for (const path of paths) {
        try {
          out.set(path, await container.getBlobClient(path).generateSasUrl({ permissions: BlobSASPermissions.parse("r"), expiresOn }));
        } catch (err) {
          console.error("[screenshot-store] sas failed", message(err));
        }
      }
      return out;
    },
    async remove(paths) {
      const results = await Promise.allSettled(paths.map((p) => container.getBlobClient(p).deleteIfExists()));
      const failed = results.find((r) => r.status === "rejected");
      return { error: failed ? message((failed as PromiseRejectedResult).reason) : null };
    },
  };
}

export function supabaseScreenshotStore(supabase: SupabaseClient): ScreenshotStore {
  const bucket = () => supabase.storage.from(SCREENSHOT_BUCKET);
  return {
    async upload(path, body, contentType) {
      const { error } = await bucket().upload(path, body, { contentType, upsert: true });
      return { error: error ? error.message : null };
    },
    async signedUrls(paths, ttlSeconds) {
      const out = new Map<string, string>();
      const { data } = await bucket().createSignedUrls(paths, ttlSeconds);
      for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl);
      return out;
    },
    async remove(paths) {
      const { error } = await bucket().remove(paths);
      return { error: error ? error.message : null };
    },
  };
}

export function screenshotStore(supabase: SupabaseClient): ScreenshotStore {
  const container = blobContainer();
  return container ? blobScreenshotStore(container) : supabaseScreenshotStore(supabase);
}
