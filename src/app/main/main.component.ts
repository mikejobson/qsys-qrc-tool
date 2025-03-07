import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { QsysLibService } from 'qsys-lib';
import { Subject, takeUntil } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';


@Component({
  selector: 'app-main',
  imports: [
    CommonModule,
    RouterModule,
    MatTabsModule
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainComponent implements OnInit, OnDestroy {
  readonly api = inject(QsysLibService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  links = [
    { label: 'Engine Status', path: 'status' },
    // { label: 'Component Tree', path: 'component-tree' },
    { label: 'All Components', path: 'components' },
  ];

  ngOnInit() {
    this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      if (!status.connected && this.api.websocketUrl) {
        this.router.navigate(['/connecting']);
      }
      else if (!status.connected) {
        this.router.navigate(['/connect']);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
