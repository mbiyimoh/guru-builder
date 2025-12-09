'use client';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface ArtifactContentProps {
  content: unknown;
  markdownContent: string | null;
  showJson: boolean;
}

export function ArtifactContent({ content, markdownContent, showJson }: ArtifactContentProps) {
  // Show JSON view when explicitly requested or when markdown is not available
  if (showJson || !markdownContent) {
    return (
      <div className="h-full overflow-auto">
        <pre className="p-6 text-sm text-gray-800 bg-gray-50 rounded-lg">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  // Render markdown content
  return (
    <div className="h-full overflow-auto">
      <article
        className="p-6 prose prose-slate max-w-none
          prose-headings:font-semibold
          prose-h1:text-2xl prose-h1:border-b-2 prose-h1:border-blue-600 prose-h1:pb-3 prose-h1:mb-8
          prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-white prose-h2:bg-blue-700 prose-h2:border-l-8 prose-h2:border-blue-900 prose-h2:pl-6 prose-h2:py-3 prose-h2:rounded-r-lg prose-h2:-ml-6 prose-h2:shadow-md
          prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-gray-800 prose-h3:pl-8 prose-h3:border-l-4 prose-h3:border-blue-300 prose-h3:bg-blue-50 prose-h3:py-2 prose-h3:rounded-r
          prose-h4:text-base prose-h4:mt-6 prose-h4:mb-3 prose-h4:text-gray-700 prose-h4:font-medium prose-h4:pl-12 prose-h4:border-l-2 prose-h4:border-gray-300
          prose-p:text-gray-700 prose-p:leading-relaxed prose-p:pl-8
          prose-strong:text-gray-900
          prose-blockquote:border-l-4 prose-blockquote:border-blue-300 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r prose-blockquote:not-italic prose-blockquote:ml-8
          prose-ul:my-4 prose-ul:pl-16 prose-li:my-2
          prose-ol:my-4 prose-ol:pl-16
          prose-hr:my-12 prose-hr:border-t-4 prose-hr:border-blue-200 prose-hr:rounded
          prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:ml-8
          prose-em:text-gray-600
          [&_details]:my-6 [&_details]:ml-8 [&_details]:bg-gray-100 [&_details]:rounded-lg [&_details]:border [&_details]:border-gray-200 [&_details]:shadow-sm
          [&_details_summary]:cursor-pointer [&_details_summary]:px-5 [&_details_summary]:py-3 [&_details_summary]:font-medium [&_details_summary]:text-blue-700 [&_details_summary]:hover:bg-gray-200 [&_details_summary]:rounded-lg [&_details_summary]:select-none
          [&_details[open]_summary]:rounded-b-none [&_details[open]_summary]:border-b [&_details[open]_summary]:border-gray-200
          [&_details>*:not(summary)]:px-5 [&_details>*:not(summary)]:pb-3"
      >
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
          {markdownContent}
        </ReactMarkdown>
      </article>
    </div>
  );
}
