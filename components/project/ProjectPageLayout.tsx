'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface ProjectPageLayoutProps {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ProjectPageLayout({
  projectId,
  projectName,
  title,
  description,
  children
}: ProjectPageLayoutProps) {
  return (
    <div className="container max-w-7xl mx-auto py-6 px-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/projects" className="hover:text-foreground transition-colors">
          Projects
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {projectName}
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <span className="text-foreground font-medium" aria-current="page">{title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2">{description}</p>
      </header>

      {children}
    </div>
  );
}
