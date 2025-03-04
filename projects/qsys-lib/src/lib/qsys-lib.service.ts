import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer, firstValueFrom } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, switchMap, takeUntil, tap, filter, retry, take, timeout, map } from 'rxjs/operators';

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

export interface QsysResponse {
  jsonrpc: string;
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// New interfaces for Component response
export interface QsysComponentProperty {
  Name: string;
  Value: string;
  PrettyName: string;
}

export interface QsysComponent {
  ControlSource: number;
  Controls: QsysControl[] | undefined;
  ID: string;
  Name: string;
  Type: string;
  Properties: QsysComponentProperty[];
}

export interface QsysControl {
  Name: string;
  Type: string;
  Value: any;
  ValueMin: number;
  ValueMax: number;
  String: string;
  StringMin: string;
  StringMax: string;
  Position: number;
  Direction: string;
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
  private responses$ = new Subject<QsysResponse>();

  private requestId = 0;
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
   * Send a command to the QSys Core and get response asynchronously
   * @param method The QRC method name
   * @param params The parameters for the command
   * @param timeoutMs Optional timeout in milliseconds (defaults to 5000ms)
   * @returns Promise with the response
   */
  public async sendCommandAsync(method: string, params: any = {}, timeoutMs = 5000): Promise<any> {
    if (!this.socket$ || !this.connectionStatus$.value.connected) {
      throw new Error('Cannot send command: not connected to QSys Core');
    }

    const id = this.getNextRequestId();

    // Create an observable that will emit the response with matching ID
    const responsePromise = firstValueFrom(
      this.responses$.pipe(
        filter(response => response.id === id),
        take(1),
        timeout(timeoutMs),
        map(response => {
          if (response.error) {
            throw new Error(`QSys error: ${response.error.message} (code ${response.error.code})`);
          }
          return response.result;
        })
      )
    );

    // Send the command
    this.sendCommand(method, params, id);

    // Wait for the response
    return responsePromise;
  }

  /**
   * Send a notification (command without response) to the QSys Core
   * @param method The QRC method name
   * @param params The parameters for the notification
   */
  public sendNotification(method: string, params: any = {}): void {
    this.sendCommand(method, params);
  }

  private getNextRequestId(): number {
    this.requestId = (this.requestId + 1) % 10000;
    return this.requestId;
  }

  /**
   * Private method to send a command to the QSys Core
   * @param method The QRC method name
   * @param params The parameters for the command
   * @param id Optional ID for the request
   */
  private sendCommand(method: string, params: any = {}, id?: number | string): void {
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
    // Handle responses (messages with IDs)
    if (message.id !== undefined) {
      this.responses$.next(message as QsysResponse);
      return;
    }

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
    // Handle other notification types as needed
  }

  private startHeartbeat(): void {
    timer(this.heartbeatInterval, this.heartbeatInterval)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.connectionStatus$.value.connected)
      )
      .subscribe(() => {
        this.sendNotification('NoOp', {});
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

  /**
   * Get a list of all components in the current design
   * @returns Promise with array of component information
   */
  public async getComponents(withControls: boolean = false): Promise<QsysComponent[]> {
    const components = this.sendCommandAsync('Component.GetComponents');
    if (withControls) {
      return components.then(async (components) => {
        for (const component of components) {
          component.Controls = await this.getControls(component.Name);
        }
        return components;
      });
    }
    return components;
  }

  /**
   * Get a list of all controls for a component
   * @param componentName The name of the component
   * @returns Promise with array of control information
   */
  public async getControls(componentName: string): Promise<QsysControl[]> {
    const response = await this.sendCommandAsync('Component.GetControls', { Name: componentName });
    return response.Controls;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
