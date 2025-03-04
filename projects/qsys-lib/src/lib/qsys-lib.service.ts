import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, switchMap, takeUntil, tap, filter, retry } from 'rxjs/operators';

export interface QsysEngineStatus {
  State: string;
  DesignName: string;
  DesignCode: string;
  IsRedundant: boolean;
  IsEmulator: boolean;
}

export interface QsysConnectionStatus {
  connected: boolean;
  engineStatus?: QsysEngineStatus;
}

@Injectable({
  providedIn: 'root'
})
export class QsysLibService implements OnDestroy {
  // Connection observables
  private connectionStatus$ = new BehaviorSubject<QsysConnectionStatus>({ connected: false });
  private engineStatus$ = new BehaviorSubject<QsysEngineStatus | null>(null);
  private destroy$ = new Subject<void>();
  private socket$?: WebSocketSubject<any>;

  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 10;
  private reconnectionDelay = 3000; // 3 seconds
  private heartbeatInterval = 30000; // 30 seconds
  private coreAddress = '';

  constructor() { }

  /**
   * Connect to a QSys Core
   * @param ipAddress The IP address of the QSys Core
   */
  public connect(ipAddress: string): void {
    this.coreAddress = ipAddress;
    this.reconnectionAttempts = 0;
    this.setupSocketConnection();
  }

  /**
   * Get observable of connection status
   */
  public getConnectionStatus(): Observable<QsysConnectionStatus> {
    return this.connectionStatus$.asObservable();
  }

  /**
   * Get observable of engine status
   */
  public getEngineStatus(): Observable<QsysEngineStatus | null> {
    return this.engineStatus$.asObservable();
  }

  /**
   * Send a command to the QSys Core
   * @param method The QRC method name
   * @param params The parameters for the command
   * @param id Optional ID for the request
   */
  public sendCommand(method: string, params: any = {}, id?: number | string): void {
    if (!this.socket$ || !this.connectionStatus$.value.connected) {
      console.error('Cannot send command: not connected to QSys Core');
      return;
    }

    const command = {
      jsonrpc: '2.0',
      method,
      params,
      ...(id !== undefined && { id })
    };

    this.socket$.next(command);
  }

  private setupSocketConnection(): void {
    if (this.socket$) {
      this.socket$.complete();
    }

    const url = `wss://${this.coreAddress}/qrc`;

    this.socket$ = webSocket({
      url,
      deserializer: (e) => JSON.parse(e.data),
      serializer: (value) => JSON.stringify(value),
      openObserver: {
        next: () => {
          console.log('QSys Core connection established');
          this.connectionStatus$.next({ connected: true });
          this.reconnectionAttempts = 0;
          this.startHeartbeat();
        }
      },
      closeObserver: {
        next: () => {
          console.log('QSys Core connection closed');
          this.connectionStatus$.next({ connected: false });
          this.attemptReconnection();
        }
      }
    });

    this.socket$.pipe(
      tap(message => this.handleMessage(message)),
      catchError(error => {
        console.error('Socket error:', error);
        this.connectionStatus$.next({ connected: false });
        this.attemptReconnection();
        throw error;
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  private handleMessage(message: any): void {
    // Handle EngineStatus notifications
    if (message.method === 'EngineStatus') {
      const engineStatus = message.params as QsysEngineStatus;
      this.engineStatus$.next(engineStatus);
      this.connectionStatus$.next({
        connected: true,
        engineStatus
      });
      console.log('Engine status updated:', engineStatus);
    }
    // Handle other message types as needed
  }

  private startHeartbeat(): void {
    timer(this.heartbeatInterval, this.heartbeatInterval)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.connectionStatus$.value.connected)
      )
      .subscribe(() => {
        this.sendCommand('NoOp', {});
      });
  }

  private attemptReconnection(): void {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectionAttempts++;
    const delay = this.reconnectionDelay * Math.pow(1.5, this.reconnectionAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectionAttempts})`);

    timer(delay)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.connectionStatus$.value.connected) {
          this.setupSocketConnection();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
