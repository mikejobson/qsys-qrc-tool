import { Routes } from '@angular/router';

// Import the same routes as your main routes file
import { routes as mainRoutes } from './app.routes';

// Export with hash location strategy enabled
export const routes: Routes = mainRoutes;

// Use hash location strategy by adding the configuration in app.config.ts
// This file will be used automatically when the github-pages configuration is selected
