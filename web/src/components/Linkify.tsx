// http(s) URLs up to whitespace; trailing punctuation that usually ends the sentence is trimmed off below.
const urlPattern = /https?:\/\/[^\s<>"]+/g;
const trailingPunctuation = /[.,;:!?'")\]]+$/;

/** Plain text with its http(s) URLs as links that open in a new tab. */
export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(urlPattern)) {
    const url = match[0].replace(trailingPunctuation, '');
    const start = match.index;
    parts.push(text.slice(last, start));
    parts.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-brand underline dark:text-teal-400"
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
