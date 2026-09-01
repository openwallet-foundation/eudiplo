import React, {type ReactNode} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {DocSearchButton} from '@docsearch/modal';
import {SidepanelButton} from '@docsearch/sidepanel';

// Swizzled navbar search bar, replacing the classic Algolia widget with the
// new DocSearch + Ask AI experience (provider mounted in src/theme/Root.tsx).
export default function SearchBarWrapper(): ReactNode {
  return (
    <BrowserOnly>
      {() => (
        <>
          <DocSearchButton />
          <SidepanelButton />
        </>
      )}
    </BrowserOnly>
  );
}
