"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyCommandProps {
  lines: string[];
}

export default function CopyCommand({ lines }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked; ignore.
    }
  };

  return (
    <div className="relative rounded-md border border-border bg-card text-left overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-5 py-4 pr-14 font-mono text-sm leading-relaxed text-foreground">
        {lines.map((line) => (
          <div key={line}>
            <span className="text-[#9b9590]">$ </span>
            {line}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy install command"}
        className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-sm border border-border-muted bg-background hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
      >
        {copied ? (
          <Check size={14} className="text-[var(--accent)]" />
        ) : (
          <Copy size={14} className="text-[#6b6560]" />
        )}
      </button>
    </div>
  );
}
