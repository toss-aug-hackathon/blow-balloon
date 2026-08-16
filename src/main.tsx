import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './utils/homeViewportClass';
import './styles/globals.css';
import './styles/home-responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
