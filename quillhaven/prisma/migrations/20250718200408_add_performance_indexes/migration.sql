-- CreateIndex
CREATE INDEX "chapter_versions_chapterId_idx" ON "chapter_versions"("chapterId");

-- CreateIndex
CREATE INDEX "chapter_versions_createdAt_idx" ON "chapter_versions"("createdAt");

-- CreateIndex
CREATE INDEX "chapters_projectId_idx" ON "chapters"("projectId");

-- CreateIndex
CREATE INDEX "chapters_status_idx" ON "chapters"("status");

-- CreateIndex
CREATE INDEX "chapters_order_idx" ON "chapters"("order");

-- CreateIndex
CREATE INDEX "chapters_updatedAt_idx" ON "chapters"("updatedAt");

-- CreateIndex
CREATE INDEX "characters_projectId_idx" ON "characters"("projectId");

-- CreateIndex
CREATE INDEX "characters_role_idx" ON "characters"("role");

-- CreateIndex
CREATE INDEX "characters_name_idx" ON "characters"("name");

-- CreateIndex
CREATE INDEX "exports_projectId_idx" ON "exports"("projectId");

-- CreateIndex
CREATE INDEX "exports_status_idx" ON "exports"("status");

-- CreateIndex
CREATE INDEX "exports_createdAt_idx" ON "exports"("createdAt");

-- CreateIndex
CREATE INDEX "plot_threads_projectId_idx" ON "plot_threads"("projectId");

-- CreateIndex
CREATE INDEX "plot_threads_status_idx" ON "plot_threads"("status");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_createdAt_idx" ON "projects"("createdAt");

-- CreateIndex
CREATE INDEX "projects_updatedAt_idx" ON "projects"("updatedAt");

-- CreateIndex
CREATE INDEX "queue_jobs_status_idx" ON "queue_jobs"("status");

-- CreateIndex
CREATE INDEX "queue_jobs_type_idx" ON "queue_jobs"("type");

-- CreateIndex
CREATE INDEX "queue_jobs_createdAt_idx" ON "queue_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "queue_jobs_attempts_idx" ON "queue_jobs"("attempts");

-- CreateIndex
CREATE INDEX "relationships_characterId_idx" ON "relationships"("characterId");

-- CreateIndex
CREATE INDEX "relationships_relatedId_idx" ON "relationships"("relatedId");

-- CreateIndex
CREATE INDEX "relationships_type_idx" ON "relationships"("type");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "timeline_events_projectId_idx" ON "timeline_events"("projectId");

-- CreateIndex
CREATE INDEX "timeline_events_importance_idx" ON "timeline_events"("importance");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_subscriptionTier_idx" ON "users"("subscriptionTier");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "world_element_relations_elementId_idx" ON "world_element_relations"("elementId");

-- CreateIndex
CREATE INDEX "world_element_relations_relatedId_idx" ON "world_element_relations"("relatedId");

-- CreateIndex
CREATE INDEX "world_elements_projectId_idx" ON "world_elements"("projectId");

-- CreateIndex
CREATE INDEX "world_elements_type_idx" ON "world_elements"("type");

-- CreateIndex
CREATE INDEX "world_elements_name_idx" ON "world_elements"("name");
