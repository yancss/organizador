-- CreateTable
CREATE TABLE "PostalPt" (
    "cp4" VARCHAR(4) NOT NULL,
    "cp3" VARCHAR(3) NOT NULL,
    "distrito" VARCHAR(80) NOT NULL,
    "concelho" VARCHAR(120) NOT NULL,
    "localidade" VARCHAR(180),

    CONSTRAINT "PostalPt_pkey" PRIMARY KEY ("cp4","cp3","distrito","concelho")
);

-- CreateIndex
CREATE INDEX "PostalPt_cp4_cp3_idx" ON "PostalPt"("cp4", "cp3");

-- CreateIndex
CREATE INDEX "PostalPt_distrito_idx" ON "PostalPt"("distrito");

-- CreateIndex
CREATE INDEX "PostalPt_concelho_idx" ON "PostalPt"("concelho");
