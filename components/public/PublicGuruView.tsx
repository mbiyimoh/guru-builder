import type { GuruProfileData } from '@/lib/guruProfile/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, GraduationCap, Target, Users } from 'lucide-react';
import Link from 'next/link';

interface Artifact {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
}

interface Props {
  profile: GuruProfileData;
  artifacts: Artifact[];
  projectName: string;
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  MENTAL_MODEL: 'Mental Model',
  CURRICULUM: 'Curriculum',
  DRILL_SERIES: 'Drill Series',
};

const ARTIFACT_TYPE_ICONS: Record<string, React.ReactNode> = {
  MENTAL_MODEL: <Target className="h-5 w-5" />,
  CURRICULUM: <BookOpen className="h-5 w-5" />,
  DRILL_SERIES: <GraduationCap className="h-5 w-5" />,
};

export default function PublicGuruView({ profile, artifacts, projectName }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{projectName}</h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-2">{profile.domainExpertise}</p>
            <div className="flex items-center justify-center gap-2 text-blue-200">
              <Users className="h-5 w-5" />
              <span className="capitalize">{profile.audienceLevel} Level</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Profile Overview */}
        <div className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>About This Guru</CardTitle>
              <CardDescription>Teaching philosophy and approach</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audience */}
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Who This Is For
                </h3>
                <p className="text-gray-700">{profile.audienceDescription}</p>
                <Badge variant="outline" className="mt-2">
                  {profile.audienceLevel} level
                </Badge>
              </div>

              {/* Teaching Style */}
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-blue-600" />
                  Teaching Approach
                </h3>
                <p className="text-gray-700 mb-2">{profile.pedagogicalApproach}</p>
                <p className="text-gray-600 text-sm">{profile.communicationStyle}</p>
                <Badge variant="outline" className="mt-2 capitalize">
                  {profile.tone} tone
                </Badge>
              </div>

              {/* Topics Covered */}
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  Topics Covered
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.specificTopics.map((topic, index) => (
                    <Badge key={index} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Unique Perspective */}
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  What Makes This Unique
                </h3>
                <p className="text-gray-700">{profile.uniquePerspective}</p>
              </div>

              {/* Example Preferences */}
              {profile.examplePreferences && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Example Style</h3>
                  <p className="text-gray-700">{profile.examplePreferences}</p>
                </div>
              )}

              {/* Emphasized Concepts */}
              {profile.emphasizedConcepts && profile.emphasizedConcepts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Key Concepts</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.emphasizedConcepts.map((concept, index) => (
                      <Badge key={index} className="bg-green-100 text-green-800 hover:bg-green-200">
                        {concept}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Misconceptions */}
              {profile.commonMisconceptions && profile.commonMisconceptions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Common Misconceptions Addressed</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {profile.commonMisconceptions.map((misconception, index) => (
                      <li key={index}>{misconception}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success Metrics */}
              <div>
                <h3 className="font-semibold text-lg mb-2">Learning Goals</h3>
                <p className="text-gray-700">{profile.successMetrics}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Content */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Available Learning Materials</h2>
          {artifacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No teaching materials available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {artifacts.map((artifact) => (
                <Link key={artifact.id} href={`/projects/${artifact.id}/artifacts/${artifact.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-blue-600">
                          {ARTIFACT_TYPE_ICONS[artifact.type] || <BookOpen className="h-5 w-5" />}
                        </div>
                        <CardTitle className="text-lg">
                          {ARTIFACT_TYPE_LABELS[artifact.type] || artifact.type}
                        </CardTitle>
                      </div>
                      <CardDescription>
                        Created {new Date(artifact.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p className="text-sm">
              Built with{' '}
              <Link
                href="https://guru-builder-production.up.railway.app"
                className="text-blue-600 hover:underline font-medium"
              >
                Guru Builder
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
