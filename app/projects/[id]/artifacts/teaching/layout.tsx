export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function TeachingArtifactLayout({ children, params }: LayoutProps) {
  // Layout is now minimal - TeachingPageHeader and ArtifactTabBar
  // are rendered inside UnifiedArtifactPage to have access to state
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-background">
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
