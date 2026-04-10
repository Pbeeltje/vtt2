import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  markdown: string;
  className?: string;
};

/**
 * Renders user-authored markdown (no raw HTML — react-markdown default).
 */
export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div
      className={cn(
        "markdown-body max-w-none text-sm leading-relaxed",
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_a]:text-primary [&_a]:underline underline-offset-2",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-[0.9em]",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:first:mt-0",
        "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold",
        "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_hr]:my-4 [&_hr]:border-border",
        className
      )}
    >
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
