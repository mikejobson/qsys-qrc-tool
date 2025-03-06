import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

// Check if we're using the GitHub Pages build
const isGithubPages = window.location.hostname.includes('github.io') ||
  window.location.href.includes('github-pages');

export const appConfig: ApplicationConfig = {
  providers: [
    // Use hash location strategy for GitHub Pages
    provideRouter(
      routes,
      ...(isGithubPages ? [withHashLocation()] : [])
    ), provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ]
};
