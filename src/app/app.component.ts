import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { QsysLibService } from 'qsys-lib';
import { filter, Subject, takeUntil } from 'rxjs';

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
  private router = inject(Router);
  private firstCheck = true;
  showHeader = false;

  constructor() {
    let address = localStorage.getItem('coreAddress');
    if (address) {
      this.api.coreAddress = address;
    }
  }

  ngOnInit(): void {
    this.api.getConnectionStatus().pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.showHeader = status.connected;
    });
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event) => {
      console.log('NavigationEnd', event);
      if (!this.firstCheck) return;
      let path = event.url.split('?')[0];
      if (path == '/connect') return;
      this.firstCheck = false;
      if (this.api.coreAddress) {
        this.api.connect(this.api.coreAddress, 2);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
