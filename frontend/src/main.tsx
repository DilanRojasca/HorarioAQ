import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import 'material-symbols/outlined.css';
import App from './App';
import './shared/app.css';
import './shared/legacy.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
