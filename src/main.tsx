import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { migrateOriginStorage } from './storage/originStorageMigration';
import './styles/globals.css';

async function bootstrap(): Promise<void> {
  await migrateOriginStorage();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
