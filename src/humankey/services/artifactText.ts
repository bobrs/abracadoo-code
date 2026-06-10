export type ArtifactTextErrorCode =
  | "EMPTY_ARTIFACT_TEXT"
  | "INVALID_ARTIFACT_JSON"
  | "UNSUPPORTED_ARTIFACT_SCHEMA";

export class ArtifactTextError extends Error {
  readonly code: ArtifactTextErrorCode;
  readonly schema?: string;
  readonly originalError?: unknown;

  constructor(code: ArtifactTextErrorCode, message: string, options?: { schema?: string; originalError?: unknown }) {
    super(message);
    this.name = "ArtifactTextError";
    this.code = code;
    if (options?.schema !== undefined) this.schema = options.schema;
    if (options?.originalError !== undefined) this.originalError = options.originalError;
  }
}

export type ParseArtifactTextOptions = {
  artifactName?: string;
  expectedSchemas?: readonly string[];
};

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/);
  return match?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (directError) {
    const firstBrace = value.indexOf("{");
    const lastBrace = value.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = value.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        // Fall through to the direct parse error so the user-facing message is stable.
      }
    }
    throw directError;
  }
}

function artifactSchema(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const schema = (value as { schema?: unknown }).schema;
  return typeof schema === "string" ? schema : undefined;
}

export function parseArtifactText(input: string, options: ParseArtifactTextOptions = {}): unknown {
  const artifactName = options.artifactName ?? "artifact";
  const normalized = stripCodeFence(input);
  if (!normalized) {
    throw new ArtifactTextError("EMPTY_ARTIFACT_TEXT", `Paste an Abracadoo ${artifactName} first.`);
  }

  let parsed: unknown;
  try {
    parsed = parseJsonObject(normalized);
  } catch (error) {
    throw new ArtifactTextError("INVALID_ARTIFACT_JSON", `This does not look like readable Abracadoo ${artifactName} JSON.`, {
      originalError: error,
    });
  }

  if (options.expectedSchemas?.length) {
    const schema = artifactSchema(parsed);
    if (!schema || !options.expectedSchemas.includes(schema)) {
      throw new ArtifactTextError(
        "UNSUPPORTED_ARTIFACT_SCHEMA",
        `This does not look like a supported Abracadoo ${artifactName}.`,
        schema === undefined ? undefined : { schema }
      );
    }
  }

  return parsed;
}

export function stringifyArtifactText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function getArtifactSchema(value: unknown): string | undefined {
  return artifactSchema(value);
}
