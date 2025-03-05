import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { QsysLibService } from 'qsys-lib';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private api = inject(QsysLibService);
  private destroy$ = new Subject<void>();
  showHeader = false;


  ngOnInit(): void {
    this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.showHeader = status.connected;
    });
    let address = localStorage.getItem('coreAddress');
    if (address) {
      this.api.connect(address);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
