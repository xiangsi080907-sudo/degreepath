-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('VERIFIED', 'PARSED', 'NEEDS_REVIEW', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'PLANNED');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('CONFIRMED', 'HISTORICAL_PATTERN');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendar" JSONB NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "termType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogVersion" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,

    CONSTRAINT "CatalogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minCredits" DOUBLE PRECISION NOT NULL,
    "maxCredits" DOUBLE PRECISION NOT NULL,
    "recommended" TEXT NOT NULL,
    "offeringPattern" TEXT NOT NULL,
    "overlaps" TEXT[],
    "restrictions" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAttribute" (
    "courseId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,

    CONSTRAINT "CourseAttribute_pkey" PRIMARY KEY ("courseId","attribute")
);

-- CreateTable
CREATE TABLE "PrerequisiteRule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedRule" JSONB NOT NULL,
    "parseStatus" "ParseStatus" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrerequisiteRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "OfferingStatus" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "sectionCode" TEXT NOT NULL,
    "meetings" JSONB NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeType" TEXT NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramCatalog" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "catalogVersionId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "status" "ParseStatus" NOT NULL,

    CONSTRAINT "ProgramCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementGroup" (
    "id" TEXT NOT NULL,
    "programCatalogId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minCredits" DOUBLE PRECISION,
    "chooseCount" INTEGER,
    "normalizedRule" JSONB NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "parseStatus" "ParseStatus" NOT NULL,

    CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCourse" (
    "requirementGroupId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "RequirementCourse_pkey" PRIMARY KEY ("requirementGroupId","courseId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "programCatalogId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "programStatuses" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCourse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL,
    "term" JSONB,
    "grade" DOUBLE PRECISION,
    "credits" DOUBLE PRECISION,

    CONSTRAINT "StudentCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL,
    "config" JSONB NOT NULL,
    "result" JSONB NOT NULL,

    CONSTRAINT "SavedPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPlanTerm" (
    "id" TEXT NOT NULL,
    "savedPlanId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,

    CONSTRAINT "SavedPlanTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPlanCourse" (
    "savedPlanTermId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "SavedPlanCourse_pkey" PRIMARY KEY ("savedPlanTermId","courseId")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" "ParseStatus" NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_institutionId_name_key" ON "Campus"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_campusId_year_termType_key" ON "AcademicTerm"("campusId", "year", "termType");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVersion_campusId_label_key" ON "CatalogVersion"("campusId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Department_campusId_code_key" ON "Department"("campusId", "code");

-- CreateIndex
CREATE INDEX "Course_campusId_subject_number_idx" ON "Course"("campusId", "subject", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Course_campusId_subject_number_key" ON "Course"("campusId", "subject", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PrerequisiteRule_courseId_key" ON "PrerequisiteRule"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_termId_key" ON "CourseOffering"("courseId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_offeringId_sectionCode_key" ON "Section"("offeringId", "sectionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Program_campusId_name_degreeType_key" ON "Program"("campusId", "name", "degreeType");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCatalog_programId_catalogVersionId_key" ON "ProgramCatalog"("programId", "catalogVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentCourse_userId_status_idx" ON "StudentCourse"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCourse_userId_courseId_key" ON "StudentCourse"("userId", "courseId");

-- CreateIndex
CREATE INDEX "SavedPlan_userId_createdAt_idx" ON "SavedPlan"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPlanTerm_savedPlanId_academicTermId_key" ON "SavedPlanTerm"("savedPlanId", "academicTermId");

-- CreateIndex
CREATE INDEX "SourceSnapshot_retrievedAt_idx" ON "SourceSnapshot"("retrievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSnapshot_sourceUrl_checksum_key" ON "SourceSnapshot"("sourceUrl", "checksum");

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogVersion" ADD CONSTRAINT "CatalogVersion_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttribute" ADD CONSTRAINT "CourseAttribute_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrerequisiteRule" ADD CONSTRAINT "PrerequisiteRule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCatalog" ADD CONSTRAINT "ProgramCatalog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramCatalog" ADD CONSTRAINT "ProgramCatalog_catalogVersionId_fkey" FOREIGN KEY ("catalogVersionId") REFERENCES "CatalogVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_programCatalogId_fkey" FOREIGN KEY ("programCatalogId") REFERENCES "ProgramCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourse" ADD CONSTRAINT "RequirementCourse_requirementGroupId_fkey" FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourse" ADD CONSTRAINT "RequirementCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programCatalogId_fkey" FOREIGN KEY ("programCatalogId") REFERENCES "ProgramCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCourse" ADD CONSTRAINT "StudentCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCourse" ADD CONSTRAINT "StudentCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlan" ADD CONSTRAINT "SavedPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlanTerm" ADD CONSTRAINT "SavedPlanTerm_savedPlanId_fkey" FOREIGN KEY ("savedPlanId") REFERENCES "SavedPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlanTerm" ADD CONSTRAINT "SavedPlanTerm_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlanCourse" ADD CONSTRAINT "SavedPlanCourse_savedPlanTermId_fkey" FOREIGN KEY ("savedPlanTermId") REFERENCES "SavedPlanTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlanCourse" ADD CONSTRAINT "SavedPlanCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

