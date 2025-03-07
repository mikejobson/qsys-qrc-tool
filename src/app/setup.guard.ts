import { Router, type CanActivateFn } from '@angular/router';
import { QsysLibService } from 'qsys-lib';
import { inject } from '@angular/core';

export const setupGuard: CanActivateFn = (route, state) => {
  const api = inject(QsysLibService);
  const router = inject(Router);
  return new Promise((resolve, reject) => {
    if (api.websocketUrl) {
      resolve(true);
    }
    resolve(router.parseUrl('/connect'));
  });
};