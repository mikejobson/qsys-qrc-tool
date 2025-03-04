import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
  QsysLibService,
  QsysConnectionStatus,
  QsysEngineStatus,
} from '../../projects/qsys-lib/src/lib/qsys-lib.service';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'qsys-web-test';
  qsysService: QsysLibService = inject(QsysLibService);

  // QSys connection properties
  connectionStatus: QsysConnectionStatus = { connected: false };
  engineStatus: QsysEngineStatus | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Set up subscriptions to track connection and engine status
    this.qsysService
      .getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        console.log('Connection status:', status);
        this.connectionStatus = status;
      });

    this.qsysService
      .getEngineStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        console.log('Engine status:', status);
        this.engineStatus = status;
      });

    // Connect to the QSys Core
    this.connectToQsysCore();
  }

  connectToQsysCore(): void {
    console.log('Connecting to QSys Core at 10.1.0.69');
    this.qsysService.connect('10.1.0.69');
  }

  // Example of sending a command to the QSys Core
  async sendTestCommand(): Promise<void> {
    let response = await this.qsysService.getComponents(true);
    console.log('Response:', response);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
