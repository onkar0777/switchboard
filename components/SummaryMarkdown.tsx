"use client";
import Markdown from "react-markdown";

// Renders the orchestrator's build summary, which arrives as markdown. The skill
// asks for one plain-language paragraph, but the model often emits **bold**,
// inline `code`, or short lists — rendered raw, those read as literal asterisks.
// Styling stays in the editorial register (DESIGN.md Add-Widget panel): the
// summary is Fraunces, the verdict voice; inline code is JetBrains Mono.
export function SummaryMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 font-serif text-[22px] leading-snug">
      <Markdown
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <code className="font-mono text-[0.85em]">{children}</code>,
          a: ({ href, children }) => (
            <a href={href} className="underline">{children}</a>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-6 text-[18px]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6 text-[18px]">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
