import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection } from './services/firebase.ts';

// Test connection to Firestore on boot
testFirestoreConnection().catch((err) => {
  console.warn('Firestore initial connection probe warning:', err);
});

createRoot(document.getElementById('root')!).render(<App />);
