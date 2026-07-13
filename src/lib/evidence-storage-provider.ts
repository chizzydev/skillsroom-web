import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from "@aws-sdk/client-s3";

function localEvidenceBaseRoot() {
  const configuredRoot = process.env.EVIDENCE_STORAGE_ROOT?.trim();
  if (configuredRoot) return configuredRoot;
  return path.join(process.cwd(), ".data");
}

const localEvidenceRoot = path.join(localEvidenceBaseRoot(), "evidence");
const localEvidenceQuarantineRoot = path.join(localEvidenceBaseRoot(), "evidence-quarantine");

export type EvidenceStorageProviderName = "local" | "s3_compatible" | "cloudflare_r2";

export type EvidenceStorageProviderStatus = {
  provider: EvidenceStorageProviderName;
  mode: "local_dev" | "s3_compatible" | "cloudflare_r2";
  root: string;
  durable: boolean;
  external: boolean;
  quarantineRoot: string;
  bucket?: string;
  endpoint?: string;
  prefix?: string;
};

export type EvidenceObjectInfo = {
  byteSize: number;
};

export type EvidenceWriteOptions = {
  exclusive?: boolean;
  contentType?: string;
};

export type EvidenceStorageProvider = {
  name: EvidenceStorageProviderName;
  status: () => EvidenceStorageProviderStatus;
  objectKey: (fileName: string) => string;
  metadataObjectKey: (fileName: string) => string;
  quarantineObjectKey: (fileName: string) => string;
  readFile: (fileName: string) => Promise<Buffer>;
  writeFile: (fileName: string, bytes: Buffer, options?: EvidenceWriteOptions) => Promise<void>;
  statFile: (fileName: string) => Promise<EvidenceObjectInfo>;
  readMetadata: (fileName: string) => Promise<unknown>;
  writeMetadata: (fileName: string, metadata: unknown, options?: EvidenceWriteOptions) => Promise<void>;
  listActiveFileNames: () => Promise<string[]>;
  listMetadataFileNames: () => Promise<string[]>;
  quarantineFile: (fileName: string) => Promise<{ originalObjectKey: string; quarantineObjectKey: string }>;
  restoreFile: (fileName: string) => Promise<{ objectKey: string; quarantineObjectKey: string }>;
  deleteFile: (fileName: string) => Promise<{ deletedObjectKey: string }>;
};

function safeObjectName(fileName: string) {
  return path.basename(fileName);
}

function appUrlHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100").hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

function localProviderAllowed() {
  if (process.env.ALLOW_UNSAFE_LOCAL_EVIDENCE_STORAGE === "true") return true;
  const host = appUrlHost();
  return host === "localhost" || host === "127.0.0.1";
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required evidence storage env: ${name}`);
  return value;
}

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function normalizePrefix(value: string | undefined) {
  const trimmed = (value || "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "";
}

function isNotFoundError(error: unknown) {
  if (error instanceof S3ServiceException) {
    return error.name === "NoSuchKey" || error.name === "NotFound" || error.$metadata.httpStatusCode === 404;
  }
  return false;
}

function eexistError(message: string) {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = "EEXIST";
  return error;
}

function encodeCopySource(bucket: string, objectKey: string) {
  return `/${bucket}/${objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  if (!stream || typeof stream !== "object") {
    throw new Error("Unsupported evidence object stream.");
  }

  if ("transformToByteArray" in stream && typeof stream.transformToByteArray === "function") {
    return Buffer.from(await stream.transformToByteArray());
  }

  const asyncIterator = (stream as Record<PropertyKey, unknown>)[Symbol.asyncIterator];
  if (typeof asyncIterator !== "function") {
    throw new Error("Unsupported evidence object stream.");
  }

  const asyncStream = stream as unknown as AsyncIterable<Uint8Array | Buffer | string>;
  const chunks: Buffer[] = [];
  for await (const chunk of asyncStream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
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
  async listActiveFileNames() {
    await ensureLocalEvidenceRoot();
    const fileNames = await readdir(localEvidenceRoot);
    return fileNames.filter((fileName) => !fileName.endsWith(".json"));
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

type ExternalProviderConfig = {
  providerName: "s3_compatible" | "cloudflare_r2";
  mode: "s3_compatible" | "cloudflare_r2";
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  forcePathStyle: boolean;
};

function readExternalProviderConfig(kind: "s3_compatible" | "cloudflare_r2"): ExternalProviderConfig {
  if (kind === "cloudflare_r2") {
    const accountId = requireEnv("EVIDENCE_R2_ACCOUNT_ID");
    return {
      providerName: "cloudflare_r2",
      mode: "cloudflare_r2",
      bucket: requireEnv("EVIDENCE_R2_BUCKET"),
      endpoint: process.env.EVIDENCE_R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
      region: process.env.EVIDENCE_R2_REGION?.trim() || "auto",
      accessKeyId: requireEnv("EVIDENCE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("EVIDENCE_R2_SECRET_ACCESS_KEY"),
      prefix: normalizePrefix(process.env.EVIDENCE_R2_PREFIX),
      forcePathStyle: boolEnv("EVIDENCE_R2_FORCE_PATH_STYLE", false)
    };
  }

  return {
    providerName: "s3_compatible",
    mode: "s3_compatible",
    bucket: requireEnv("EVIDENCE_S3_BUCKET"),
    endpoint: process.env.EVIDENCE_S3_ENDPOINT?.trim() || undefined,
    region: process.env.EVIDENCE_S3_REGION?.trim() || "us-east-1",
    accessKeyId: requireEnv("EVIDENCE_S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("EVIDENCE_S3_SECRET_ACCESS_KEY"),
    prefix: normalizePrefix(process.env.EVIDENCE_S3_PREFIX),
    forcePathStyle: boolEnv("EVIDENCE_S3_FORCE_PATH_STYLE", false)
  };
}

function createExternalProvider(config: ExternalProviderConfig): EvidenceStorageProvider {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  const objectKey = (fileName: string) => `${config.prefix}active/${safeObjectName(fileName)}`;
  const metadataObjectKey = (fileName: string) => `${config.prefix}metadata/${safeObjectName(fileName)}.json`;
  const quarantineObjectKey = (fileName: string) => `${config.prefix}quarantine/${safeObjectName(fileName)}`;
  const root = `${config.bucket}/${config.prefix || ""}active`;
  const quarantineRoot = `${config.bucket}/${config.prefix || ""}quarantine`;

  async function head(key: string) {
    return client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  }

  async function getObjectBuffer(key: string) {
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    return streamToBuffer(response.Body);
  }

  async function ensureExclusive(keys: string[]) {
    for (const key of keys) {
      try {
        await head(key);
        throw eexistError(`Evidence object already exists at ${key}`);
      } catch (error) {
        if (isNotFoundError(error)) continue;
        throw error;
      }
    }
  }

  async function copyAndDelete(sourceKey: string, targetKey: string) {
    await client.send(
      new CopyObjectCommand({
        Bucket: config.bucket,
        CopySource: encodeCopySource(config.bucket, sourceKey),
        Key: targetKey
      })
    );
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: sourceKey }));
  }

  return {
    name: config.providerName,
    status: () => ({
      provider: config.providerName,
      mode: config.mode,
      root,
      durable: true,
      external: true,
      quarantineRoot,
      bucket: config.bucket,
      endpoint: config.endpoint,
      prefix: config.prefix || undefined
    }),
    objectKey,
    metadataObjectKey,
    quarantineObjectKey,
    async readFile(fileName) {
      try {
        return await getObjectBuffer(objectKey(fileName));
      } catch (error) {
        if (isNotFoundError(error)) return getObjectBuffer(quarantineObjectKey(fileName));
        throw error;
      }
    },
    async writeFile(fileName, bytes, options) {
      if (options?.exclusive) {
        await ensureExclusive([objectKey(fileName), quarantineObjectKey(fileName)]);
      }
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey(fileName),
          Body: bytes,
          ContentType: options?.contentType ?? "application/octet-stream"
        })
      );
    },
    async statFile(fileName) {
      try {
        const response = await head(objectKey(fileName));
        return { byteSize: Number(response.ContentLength || 0) };
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }

      const response = await head(quarantineObjectKey(fileName));
      return { byteSize: Number(response.ContentLength || 0) };
    },
    async readMetadata(fileName) {
      const raw = await getObjectBuffer(metadataObjectKey(fileName));
      return JSON.parse(raw.toString("utf8")) as unknown;
    },
    async writeMetadata(fileName, metadata, options) {
      if (options?.exclusive) {
        await ensureExclusive([metadataObjectKey(fileName)]);
      }
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: metadataObjectKey(fileName),
          Body: Buffer.from(JSON.stringify(metadata, null, 2)),
          ContentType: "application/json"
        })
      );
    },
    async listMetadataFileNames() {
      const prefix = `${config.prefix}metadata/`;
      let continuationToken: string | undefined;
      const fileNames: string[] = [];

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken
          })
        );
        for (const object of response.Contents ?? []) {
          const key = object.Key || "";
          if (!key.endsWith(".json")) continue;
          fileNames.push(path.basename(key).replace(/\.json$/, ""));
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return fileNames;
    },
    async listActiveFileNames() {
      const prefix = `${config.prefix}active/`;
      let continuationToken: string | undefined;
      const fileNames: string[] = [];

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken
          })
        );
        for (const object of response.Contents ?? []) {
          const key = object.Key || "";
          if (!key || key.endsWith("/")) continue;
          fileNames.push(path.basename(key));
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return fileNames;
    },
    async quarantineFile(fileName) {
      const originalObjectKey = objectKey(fileName);
      const targetKey = quarantineObjectKey(fileName);
      await copyAndDelete(originalObjectKey, targetKey);
      return {
        originalObjectKey,
        quarantineObjectKey: targetKey
      };
    },
    async restoreFile(fileName) {
      const sourceKey = quarantineObjectKey(fileName);
      const targetKey = objectKey(fileName);
      await copyAndDelete(sourceKey, targetKey);
      return {
        objectKey: targetKey,
        quarantineObjectKey: sourceKey
      };
    },
    async deleteFile(fileName) {
      const quarantineKey = quarantineObjectKey(fileName);
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: quarantineKey }));
        return { deletedObjectKey: quarantineKey };
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }

      const activeKey = objectKey(fileName);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: activeKey }));
      return { deletedObjectKey: activeKey };
    }
  };
}

export function evidenceStorageProvider(): EvidenceStorageProvider {
  const configuredProvider = (process.env.EVIDENCE_STORAGE_PROVIDER || "local").trim().toLowerCase();

  if (configuredProvider === "local") {
    if (!localProviderAllowed()) {
      throw new Error(
        'Local evidence storage is disabled for public deployments. Configure EVIDENCE_STORAGE_PROVIDER as "s3_compatible" or "cloudflare_r2".'
      );
    }
    return localEvidenceStorageProvider;
  }

  if (configuredProvider === "s3_compatible") return createExternalProvider(readExternalProviderConfig("s3_compatible"));
  if (configuredProvider === "cloudflare_r2") return createExternalProvider(readExternalProviderConfig("cloudflare_r2"));

  throw new Error(
    `Unsupported EVIDENCE_STORAGE_PROVIDER "${configuredProvider}". Supported values: local, s3_compatible, cloudflare_r2.`
  );
}

export function evidenceStorageProviderStatus() {
  return evidenceStorageProvider().status();
}
