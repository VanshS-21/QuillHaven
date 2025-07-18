'use client';

import { ProjectDashboard } from '@/components/project';
import { AuthGuard } from '@/components/auth';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <ProjectDashboard />
        </div>
      </div>
    </AuthGuard>
  );
}
