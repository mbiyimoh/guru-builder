import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Guru Builder
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Build AI teaching assistants through autonomous research and structured recommendations.
          Improve your knowledge corpus with AI-powered suggestions.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-blue-600 mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">1. Create Project</h3>
          <p className="text-gray-600">
            Set up your AI knowledge base with context layers and curated knowledge files.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-green-600 mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">2. Run Research</h3>
          <p className="text-gray-600">
            AI autonomously researches topics and generates improvement recommendations.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="text-purple-600 mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">3. Apply Changes</h3>
          <p className="text-gray-600">
            Review AI recommendations and apply approved changes with version control.
          </p>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/projects"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Get Started with Projects
          <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="mt-16 bg-white rounded-lg shadow-sm border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">System Features</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Autonomous Research</h3>
            <p className="text-gray-600">GPT Researcher autonomously explores topics in-depth with configurable research depth.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">AI Recommendations</h3>
            <p className="text-gray-600">OpenAI GPT-4 generates structured ADD/EDIT/DELETE recommendations for your corpus.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Version Control</h3>
            <p className="text-gray-600">Automatic snapshots before changes allow rollback to any previous state.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Background Processing</h3>
            <p className="text-gray-600">Inngest handles long-running research tasks without blocking your workflow.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
