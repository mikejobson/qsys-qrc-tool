import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { QsysEngineStatus } from 'qsys-lib';
import { QsysConnectionStatus, QsysLibService } from 'qsys-lib';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-main',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainComponent implements OnInit, OnDestroy {
  readonly api = inject(QsysLibService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private cd = inject(ChangeDetectorRef);
  connectionStatus: QsysConnectionStatus = { connected: false };
  engineStatus: QsysEngineStatus | null = null;

  ngOnInit() {
    this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.connectionStatus = status;
      console.log('Connection status:', status);
      if (!status.connected && this.api.coreAddress && this.api.coreAddress.length > 0) {
        this.router.navigate(['/connecting']);
      }
      else if (!status.connected) {
        this.router.navigate(['/connect']);
      }
      this.cd.markForCheck();
    });
    this.api.getEngineStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.engineStatus = status;
      this.cd.markForCheck();
    });
  }

  reconnect() {
    this.api.connect();
  }

  disconnect() {
    this.api.disconnect(true);
  }

  sendTestCommand() {

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
