import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const localEvidenceRoot = path.join(process.cwd(), ".data", "evidence");
const localEvidenceQuarantineRoot = path.join(process.cwd(), ".data", "evidence-quarantine");

export type EvidenceStorageProviderName = "local";

export type EvidenceStorageProviderStatus = {
  provider: EvidenceStorageProviderName;
  mode: "local_dev";
  root: string;
  durable: false;
  external: false;
  quarantineRoot: string;
};

export type EvidenceObjectInfo = {
  byteSize: number;
};

export type EvidenceStorageProvider = {
  name: EvidenceStorageProviderName;
  status: () => EvidenceStorageProviderStatus;
  objectKey: (fileName: string) => string;
  metadataObjectKey: (fileName: string) => string;
  quarantineObjectKey: (fileName: string) => string;
  readFile: (fileName: string) => Promise<Buffer>;
  writeFile: (fileName: string, bytes: Buffer, options?: { exclusive?: boolean }) => Promise<void>;
  statFile: (fileName: string) => Promise<EvidenceObjectInfo>;
  readMetadata: (fileName: string) => Promise<unknown>;
  writeMetadata: (fileName: string, metadata: unknown, options?: { exclusive?: boolean }) => Promise<void>;
  listMetadataFileNames: () => Promise<string[]>;
  quarantineFile: (fileName: string) => Promise<{ originalObjectKey: string; quarantineObjectKey: string }>;
  restoreFile: (fileName: string) => Promise<{ objectKey: string; quarantineObjectKey: string }>;
  deleteFile: (fileName: string) => Promise<{ deletedObjectKey: string }>;
};

function safeObjectName(fileName: string) {
  return path.basename(fileName);
}

export function localEvidenceStoragePath(fileName: string) {
  return path.join(localEvidenceRoot, safeObjectName(fileName));
}

export function localEvidenceMetadataPath(fileName: string) {
  return `${localEvidenceStoragePath(fileName)}.json`;
}

export function localEvidenceQuarantinePath(fileName: string) {
  return path.join(localEvidenceQuarantineRoot, safeObjectName(fileName));
}

async function ensureLocalEvidenceRoot() {
  await mkdir(localEvidenceRoot, { recursive: true });
}

async function ensureLocalEvidenceQuarantineRoot() {
  await mkdir(localEvidenceQuarantineRoot, { recursive: true });
}

const localEvidenceStorageProvider: EvidenceStorageProvider = {
  name: "local",
  status: () => ({
    provider: "local",
    mode: "local_dev",
    root: localEvidenceRoot,
    durable: false,
    external: false,
    quarantineRoot: localEvidenceQuarantineRoot
  }),
  objectKey: localEvidenceStoragePath,
  metadataObjectKey: localEvidenceMetadataPath,
  quarantineObjectKey: localEvidenceQuarantinePath,
  async readFile(fileName) {
    try {
      return await readFile(localEvidenceStoragePath(fileName));
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
      if (code === "ENOENT") return readFile(localEvidenceQuarantinePath(fileName));
      throw error;
    }
  },
  async writeFile(fileName, bytes, options) {
    await ensureLocalEvidenceRoot();
    await writeFile(localEvidenceStoragePath(fileName), bytes, options?.exclusive ? { flag: "wx" } : undefined);
  },
  async statFile(fileName) {
    let fileStat;
    try {
      fileStat = await stat(localEvidenceStoragePath(fileName));
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
      if (code !== "ENOENT") throw error;
      fileStat = await stat(localEvidenceQuarantinePath(fileName));
    }
    return { byteSize: fileStat.size };
  },
  async readMetadata(fileName) {
    const raw = await readFile(localEvidenceMetadataPath(fileName), "utf8");
    return JSON.parse(raw) as unknown;
  },
  async writeMetadata(fileName, metadata, options) {
    await ensureLocalEvidenceRoot();
    await writeFile(
      localEvidenceMetadataPath(fileName),
      JSON.stringify(metadata, null, 2),
      options?.exclusive ? { flag: "wx" } : undefined
    );
  },
  async listMetadataFileNames() {
    await ensureLocalEvidenceRoot();
    const fileNames = await readdir(localEvidenceRoot);
    return fileNames.filter((fileName) => fileName.endsWith(".json")).map((fileName) => fileName.replace(/\.json$/, ""));
  },
  async quarantineFile(fileName) {
    await ensureLocalEvidenceQuarantineRoot();
    const originalObjectKey = localEvidenceStoragePath(fileName);
    const quarantineObjectKey = localEvidenceQuarantinePath(fileName);
    await rename(originalObjectKey, quarantineObjectKey);
    return { originalObjectKey, quarantineObjectKey };
  },
  async restoreFile(fileName) {
    await ensureLocalEvidenceRoot();
    const objectKey = localEvidenceStoragePath(fileName);
    const quarantineObjectKey = localEvidenceQuarantinePath(fileName);
    await rename(quarantineObjectKey, objectKey);
    return { objectKey, quarantineObjectKey };
  },
  async deleteFile(fileName) {
    const objectKey = localEvidenceStoragePath(fileName);
    const quarantineObjectKey = localEvidenceQuarantinePath(fileName);
    try {
      await unlink(quarantineObjectKey);
      return { deletedObjectKey: quarantineObjectKey };
    } catch (error) {
      const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
      if (code !== "ENOENT") throw error;
    }

    await unlink(objectKey);
    return { deletedObjectKey: objectKey };
  }
};

export function evidenceStorageProvider(): EvidenceStorageProvider {
  const configuredProvider = (process.env.EVIDENCE_STORAGE_PROVIDER || "local").trim().toLowerCase();
  if (configuredProvider === "local") return localEvidenceStorageProvider;

  throw new Error(
    `Unsupported EVIDENCE_STORAGE_PROVIDER "${configuredProvider}". Configure "local" until an external provider adapter is implemented.`
  );
}

export function evidenceStorageProviderStatus() {
  return evidenceStorageProvider().status();
}
