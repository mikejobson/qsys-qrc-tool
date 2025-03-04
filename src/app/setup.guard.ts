import { Router, type CanActivateFn } from '@angular/router';
import { QsysLibService } from '../../projects/qsys-lib/src/public-api';
import { inject } from '@angular/core';

export const setupGuard: CanActivateFn = (route, state) => {
  const api: QsysLibService = inject(QsysLibService);
  const router = inject(Router);
  if (api.coreAddress && api.coreAddress.length > 0) {
    return true;
  }
  router.navigate(['/connect']);
  return false;
};