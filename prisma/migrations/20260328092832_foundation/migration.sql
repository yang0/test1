-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "descriptionOriginal" TEXT,
    "descriptionZh" TEXT,
    "descriptionTranslationStatus" TEXT NOT NULL DEFAULT 'pending',
    "language" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "starsToday" INTEGER NOT NULL DEFAULT 0,
    "homepageUrl" TEXT,
    "defaultBranch" TEXT,
    "trendingRank" INTEGER,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReadmeDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "sourceSha" TEXT NOT NULL,
    "contentOriginal" TEXT NOT NULL,
    "contentZh" TEXT,
    "translationStatus" TEXT NOT NULL DEFAULT 'pending',
    "translatedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadmeDocument_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT,
    "promptText" TEXT NOT NULL,
    "targetTmuxSession" TEXT,
    "targetTmuxWindow" TEXT,
    "targetTmuxPane" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "InstallJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocalProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT,
    "rootPath" TEXT NOT NULL,
    "projectPath" TEXT NOT NULL,
    "gitRemoteUrl" TEXT,
    "detectedName" TEXT NOT NULL,
    "cloneStatus" TEXT NOT NULL DEFAULT 'discovered',
    "installStatus" TEXT NOT NULL DEFAULT 'unknown',
    "lastScannedAt" DATETIME,
    "lastInstalledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocalProject_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "projectRootPath" TEXT,
    "defaultTmuxSession" TEXT,
    "defaultTmuxWindow" TEXT,
    "defaultTmuxPane" TEXT,
    "translationPromptTemplate" TEXT NOT NULL,
    "installPromptTemplate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_repoUrl_key" ON "Repository"("repoUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_owner_name_key" ON "Repository"("owner", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ReadmeDocument_repositoryId_sourceSha_key" ON "ReadmeDocument"("repositoryId", "sourceSha");

-- CreateIndex
CREATE UNIQUE INDEX "LocalProject_projectPath_key" ON "LocalProject"("projectPath");
