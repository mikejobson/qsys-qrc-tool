import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { QsysLibService } from 'qsys-lib';

export const connectingGuard: CanActivateFn = (route, state) => {
  const api: QsysLibService = inject(QsysLibService);
  const router = inject(Router);
  return new Promise((resolve, reject) => {
    if (api.isConnected) return resolve(true);
    return resolve(router.parseUrl('/connecting?returnUrl=' + state.url));
  });
};
