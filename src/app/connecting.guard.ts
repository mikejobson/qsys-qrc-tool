import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { QsysLibService } from 'qsys-lib';

export const connectingGuard: CanActivateFn = (route, state) => {
  const api: QsysLibService = inject(QsysLibService);
  const router = inject(Router);
  if (api.isConnected) return true;
  router.navigate(['/connecting']);
  return false;
};
