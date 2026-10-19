import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { testFirestoreConnection } from './services/firebase.ts';

// Test connection to Firestore on boot safely without throwing
testFirestoreConnection().catch((err) => {
  console.warn('Firestore initial connection probe warning:', err);
});

// Guard against unhandled promise rejections that might otherwise crash WebViews
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('AZORA caught unhandled promise rejection:', event.reason);
    // Prevent default crash popup in certain hybrid webviews
    event.preventDefault();
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
