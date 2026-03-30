import {
  TranslationStatus,
  type Prisma,
  type ReadmeDocument,
} from "@/lib/server/prisma-client";
import { prisma } from "@/lib/server/db";

export type UpsertReadmeDocumentInput = {
  repositoryId: string;
  sourceSha: string;
  contentOriginal: string;
  contentZh?: string | null;
  translationStatus?: TranslationStatus;
  translatedAt?: Date | null;
  errorMessage?: string | null;
};

export function buildReadmeDocumentUpsertInput(
  input: UpsertReadmeDocumentInput,
): Prisma.ReadmeDocumentUpsertArgs {
  const data: Prisma.ReadmeDocumentUncheckedCreateInput = {
    repositoryId: input.repositoryId,
    sourceSha: input.sourceSha,
    contentOriginal: input.contentOriginal,
    contentZh: input.contentZh ?? null,
    translationStatus: input.translationStatus ?? TranslationStatus.pending,
    translatedAt: input.translatedAt ?? null,
    errorMessage: input.errorMessage ?? null,
  };

  return {
    where: {
      repositoryId_sourceSha: {
        repositoryId: input.repositoryId,
        sourceSha: input.sourceSha,
      },
    },
    create: data,
    update: data,
  };
}

export async function upsertReadmeDocument(input: UpsertReadmeDocumentInput) {
  return prisma.readmeDocument.upsert(buildReadmeDocumentUpsertInput(input));
}

export async function getLatestReadmeDocument(repositoryId: string): Promise<ReadmeDocument | null> {
  return prisma.readmeDocument.findFirst({
    where: {
      repositoryId,
      translationStatus: TranslationStatus.done,
      contentZh: { not: null },
    },
    orderBy: [{ translatedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function deleteReadmeDocuments(repositoryId: string) {
  return prisma.readmeDocument.deleteMany({
    where: { repositoryId },
  });
}
