import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, Router } from '@angular/router';
import { QsysLibService } from 'qsys-lib';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-connecting',
  imports: [
    MatProgressSpinnerModule
  ],
  templateUrl: './connecting.component.html',
  styleUrl: './connecting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectingComponent implements OnInit, OnDestroy {
  readonly api: QsysLibService = inject(QsysLibService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  ngOnInit() {
    if (!this.api.coreAddress || this.api.coreAddress.length == 0) {
      this.router.navigate(['/connect']);
      return;
    }
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      let returnUrl = params['returnUrl'];
      this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
        console.log('Connection status:', status);
        if (status.connected) {
          this.router.navigate([returnUrl || '/']);
        }
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
