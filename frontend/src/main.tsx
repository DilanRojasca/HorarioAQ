import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './shared/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
