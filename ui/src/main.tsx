import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Browser from './components/Browser.tsx';
import TopBar from './components/TopBar.tsx';
import BottomBar from './components/BottomBar.tsx';
import System from './components/System.tsx';
import Deck from './components/Deck.tsx';

const searchParams = new URLSearchParams(window.location.search);
const view = searchParams.get('view');
const deckIdParam = searchParams.get('deckId') ?? undefined;

const isDeckOnlyView = view === 'deck';

const deckId = deckIdParam ?? 1;

if (isDeckOnlyView) {
  document.title = `NevealDJ - Deck ${deckId}`;
} else {
  document.title = 'NevealDJ';
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    {isDeckOnlyView ? (
      <Deck id={deckId} disableExpand />
    ) : (
      <>
        <TopBar />
        <main className="h-full flex flex-col min-h-0">
          <System />
          <Browser />
        </main>
      </>
    )}
  </StrictMode>,
);
