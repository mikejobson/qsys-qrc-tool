import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, type OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { QsysConnectionStatus, QsysEngineStatus, QsysLibService } from 'qsys-lib';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-engine-status',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule
  ],
  templateUrl: './engine-status.component.html',
  styleUrl: './engine-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineStatusComponent implements OnInit, OnDestroy {
  readonly api = inject(QsysLibService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private cd = inject(ChangeDetectorRef);
  connectionStatus: QsysConnectionStatus = { connected: false };
  engineStatus: QsysEngineStatus | null = null;

  ngOnInit(): void {
    this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.connectionStatus = status;
      this.cd.markForCheck();
    });
    this.api.getEngineStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.engineStatus = status;
      this.cd.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reconnect() {
    this.api.connect(this.api.coreAddress!);
  }

  disconnect() {
    this.api.disconnect();
  }

}
