import { Fragment, type ReactNode } from 'react';
import { parseInline } from '@/lib/inline';

/** Renders stored inline markup (src/lib/inline.ts) as React elements, never as raw HTML. */
export function Inline({ markup }: { markup: string }) {
  return (
    <>
      {parseInline(markup).map((segment, i) => {
        let node: ReactNode = segment.text;
        if (segment.italic) node = <i>{node}</i>;
        if (segment.bold) node = <b>{node}</b>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}
