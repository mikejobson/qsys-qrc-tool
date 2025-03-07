import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer, firstValueFrom } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, switchMap, takeUntil, tap, filter, retry, take, timeout, map } from 'rxjs/operators';

export const AUTO_POLL_DEFAULT_ID = 'auto';
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export interface QsysEngineStatus {
  State: string;
  Platform: string;
  DesignName: string;
  DesignCode: string;
  IsRedundant: boolean;
  IsEmulator: boolean;
  Status: QsysEngineStatusStatus;
}

export interface QsysEngineStatusStatus {
  Code: number;
  String: string;
}

export interface QsysConnectionStatus {
  connected: boolean;
  noReconnect?: boolean;
  engineStatus?: QsysEngineStatus;
  newDesign?: boolean;  // Flag to indicate if the design code has changed
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

export interface QsysComponentData {
  ControlSource: number;
  Controls: QsysControlData[] | undefined;
  ID: string;
  Name: string;
  Type: string;
  Properties: QsysComponentProperty[];
}

export interface QsysControlData {
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

export interface QsysChangeData {
  Component: string;
  Name: string;
  String: string;
  Value: any;
  Position: number;
}

export class QsysComponent {
  private _data: QsysComponentData;
  private _controls: { [name: string]: QsysControl } = {};
  private _api: QsysLibService;
  private _subscription: any;
  private _updated: Subject<QsysControl[]> = new Subject<QsysControl[]>();

  constructor(api: QsysLibService, data: QsysComponentData) {
    this._api = api;
    this._data = data;
    if (data.Controls) {
      for (const controlData of data.Controls) {
        this._controls[controlData.Name] = new QsysControl(api, this, controlData);
      }
    }
  }

  get name(): string {
    return this._data.Name;
  }

  get type(): string {
    return this._data.Type;
  }

  get id(): string {
    return this._data.ID;
  }

  get properties(): QsysComponentProperty[] {
    return this._data.Properties;
  }

  get controls(): QsysControl[] {
    return Object.values(this._controls);
  }

  getControl(name: string): QsysControl | undefined {
    return this._controls[name];
  }

  async subscribe(): Promise<void> {
    await this._api.changeGroupAddControls(AUTO_POLL_DEFAULT_ID, this.name, Object.keys(this._controls));
    let response = await this._api.changeGroupPoll(AUTO_POLL_DEFAULT_ID);
    response.changes.forEach((change) => {
      let changed = [];
      let control = this.getControl(change.Name);
      if (control) {
        if (control._update(change)) {
          changed.push(control);
        }
      }
      if (changed.length > 0) {
        this._updated.next(changed);
      }
    });
    if (this._subscription) return;
    this._subscription = this._api.getChangeGroupUpdates().subscribe(async (update) => {
      if (update.changeGroupId !== AUTO_POLL_DEFAULT_ID) {
        return;
      }
      let updated = [];
      for (const change of update.changes) {
        if (change.Component === this.name) {
          let control = this.getControl(change.Name);
          if (control) {
            if (control._update(change)) {
              updated.push(control);
            }
          }
        }
      }
      if (updated.length > 0) {
        this._updated.next(updated);
      }
    });
  }

  get updated(): Observable<QsysControl[]> {
    return this._updated.asObservable();
  }

  destroy(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
    }
  }
}

export class QsysControl {
  private _component: QsysComponent;
  private _data: QsysControlData;
  private _api: QsysLibService;
  private _updated: Subject<QsysControl> = new Subject<QsysControl>();

  constructor(api: QsysLibService, component: QsysComponent, data: QsysControlData) {
    this._api = api;
    this._component = component;
    this._data = data;
  }

  get component(): QsysComponent {
    return this._component;
  }

  get name(): string {
    return this._data.Name;
  }

  get type(): string {
    return this._data.Type;
  }

  get value(): any {
    if (this._data.Type == "Text") {
      return this._data.String;
    }
    if (this._data.Type == "Float") {
      // return rounded to nearest 1 decimal place
      return Math.round(this._data.Value * 10) / 10;
    }
    return this._data.Value;
  }

  async setValue(value: any) {
    if (this.canWrite) {
      let response = await this._api.setComponentValue(this.component.name, this.name, value);
      await this._api._changeGroupPollInternal();
    }
    else {
      console.error(`Cannot write to control ${this.name}: it is read-only`);
    }
  }

  async rampValue(value: any, ramp: number) {
    if (this.canWrite) {
      await this._api.setComponentValue(this.component.name, this.name, value, ramp);
    }
    else {
      console.error(`Cannot write to control ${this.name}: it is read-only`);
    }
  }

  get valueMin(): number {
    return this._data.ValueMin;
  }

  get valueMax(): number {
    return this._data.ValueMax;
  }

  get string(): string {
    return this._data.String;
  }

  get stringMin(): string {
    return this._data.StringMin;
  }

  get stringMax(): string {
    return this._data.StringMax;
  }

  /**
   * Get the current position of the control (value between 0-1)
   */
  get position(): number {
    return this._data.Position;
  }

  /**
   * Set the position of a control
   * @param position The new position for the control (value between 0-1)
   */
  async setPosition(position: number) {
    if (this.canWrite) {
      await this._api.setComponentPosition(this.component.name, this.name, position);
      await this._api._changeGroupPollInternal();
    }
    else {
      console.error(`Cannot write to control ${this.name}: it is read-only`);
    }
  }

  /**
   * Ramp the position of a control over time
   * @param position The target position (value between 0-1)
   * @param ramp Time in seconds to reach the target position
   */
  async rampPosition(position: number, ramp: number) {
    if (this.canWrite) {
      await this._api.setComponentPosition(this.component.name, this.name, position, ramp);
    }
    else {
      console.error(`Cannot write to control ${this.name}: it is read-only`);
    }
  }

  async trigger() {
    if (this.canWrite) {
      await this._api.setComponentValue(this.component.name, this.name, 1);
      await this._api._changeGroupPollInternal();
    }
    else {
      console.error(`Cannot write to control ${this.name}: it is read-only`);
    }
  }

  get canWrite(): boolean {
    return this._data.Direction === 'Read/Write';
  }

  get updated(): Observable<QsysControl> {
    return this._updated.asObservable();
  }

  _update(change: QsysChangeData): boolean {
    let changed = false;
    if (change.Value !== undefined && this._data.Value != change.Value) {
      if (this._data.Type == "Boolean") {
        this._data.Value = Boolean(change.Value)
      }
      else {
        this._data.Value = change.Value;
      }
      changed = true;
    }
    if (change.Position !== undefined && this._data.Position != change.Position) {
      this._data.Position = change.Position;
      changed = true;
    }
    if (change.String !== undefined && this._data.String != change.String) {
      this._data.String = change.String;
      changed = true;
    }
    if (changed) {
      this._updated.next(this);
    }
    return changed;
  }
}

@Injectable({
  providedIn: 'root'
})
export class QsysLibService implements OnDestroy {
  // Connection observables
  private connectionStatus$ = new BehaviorSubject<QsysConnectionStatus>({ connected: false });
  private engineStatus$ = new BehaviorSubject<QsysEngineStatus | null>(null);
  private changeGroupUpdates$ = new Subject<{ changeGroupId: string, changes: QsysChangeData[] }>();
  private destroy$ = new Subject<void>();
  private socket$?: WebSocketSubject<any>;
  private responses$ = new Subject<QsysResponse>();

  // Add private field for connection state
  private _isConnected = false;
  private reconnecting = false; // Add this flag to track if reconnection is allowed

  private requestId = 0;
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 0;
  private reconnectionDelay = 3000; // 3 seconds
  private heartbeatInterval = 30000; // 30 seconds
  private _components: { [name: string]: QsysComponent } = {};
  private designCode: string | undefined;
  private pollInternalTimeout: any;

  // Store the websocket URL directly
  private _websocketUrl: string | undefined;

  constructor() { }

  /**
   * Format a websocket URL from an IP address or hostname
   * @param addressOrPath IP address, hostname, or path (starting with /)
   * @returns Formatted websocket URL
   */
  public static formatWebsocketUrl(addressOrPath: string): string {
    // If it starts with a slash, use the current host
    if (addressOrPath.startsWith('/')) {
      const currentHost = typeof window !== 'undefined' ? window.location.host : '';
      return `wss://${currentHost}${addressOrPath}`;
    }

    // Otherwise, remove any protocol prefixes if they exist
    const cleanAddress = addressOrPath.replace(/^(https?:\/\/|wss?:\/\/)/i, '');
    return `wss://${cleanAddress}/qrc`;
  }

  /**
   * Connect to a QSys Core
   * @param addressOrUrl The address, path, or complete websocket URL
   *                     - IP/hostname: will be converted to wss://address/qrc
   *                     - Path (starts with /): will use current host with the path
   *                     - Full URL: used directly
   * @param maxReconnectionAttempts Maximum number of reconnection attempts (0 for infinite)
   */
  public connect(addressOrUrl: string, maxReconnectionAttempts = 0): void {
    this.maxReconnectionAttempts = maxReconnectionAttempts;

    // Determine if the input is a complete URL or needs formatting
    if (addressOrUrl.startsWith('ws://') || addressOrUrl.startsWith('wss://')) {
      // Complete URL, use as is
      this._websocketUrl = addressOrUrl;
    } else {
      // Format the URL based on whether it's a path or address
      this._websocketUrl = QsysLibService.formatWebsocketUrl(addressOrUrl);
    }

    console.log('Connecting to QSys Core at', this._websocketUrl);
    if (!this._websocketUrl) {
      console.error('Cannot connect: no address provided');
      return;
    }

    // Allow reconnection attempts again
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.connectionStatus$.next({ connected: false, noReconnect: false });
    this.setupSocketConnection();
  }

  /**
   * Get the current websocket URL
   */
  public get websocketUrl(): string | undefined {
    return this._websocketUrl;
  }

  /**
   * Set the websocket URL directly
   */
  public set websocketUrl(url: string | undefined) {
    this._websocketUrl = url;
  }

  public disconnect(): void {
    // Prevent any further reconnection attempts
    this.reconnecting = false;
    this._websocketUrl = undefined;

    // Cancel any pending reconnections
    this.reconnectionAttempts = Number.MAX_SAFE_INTEGER;

    // Close the websocket
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }

    // Update connection state
    this._isConnected = false;
    this.connectionStatus$.next({ connected: false, noReconnect: true });

    // Don't emit on destroy$ yet (this would terminate everything including this method)
    // Instead, only emit if we're truly destroying the service
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

  public getChangeGroupUpdates(): Observable<{ changeGroupId: string, changes: QsysChangeData[] }> {
    return this.changeGroupUpdates$.asObservable();
  }

  /**
   * Send a command to the QSys Core and get response asynchronously
   * @param method The QRC method name
   * @param params The parameters for the command
   * @param timeoutMs Optional timeout in milliseconds (defaults to 5000ms)
   * @returns Promise with the response
   */
  public async sendCommandAsync(method: string, params: any = {}, timeoutMs = 5000): Promise<any> {
    if (!this.socket$) {
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
            throw new Error(`QSys error: ${response.error.message} (code ${response.error.code})`, { cause: response.error });
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
    if (!this.socket$) {
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

    if (!this._websocketUrl) {
      console.error('Cannot connect: no websocket URL provided');
      return;
    }

    this.socket$ = webSocket({
      url: this._websocketUrl,
      deserializer: (e) => JSON.parse(e.data),
      serializer: (value) => JSON.stringify(value),
      openObserver: {
        next: () => {
          console.log('QSys Core socket connection established');
          // Don't mark as connected yet - wait for EngineStatus notification
          this.reconnectionAttempts = 0;
          this.startHeartbeat();
        }
      },
      closeObserver: {
        next: () => {
          console.log('QSys Core connection closed');
          this._isConnected = false;
          this.connectionStatus$.next({ connected: false });
          this.attemptReconnection();
        }
      }
    });

    this.socket$.pipe(
      tap(message => this.handleMessage(message)),
      catchError(error => {
        console.error('Socket error:', error);
        this._isConnected = false;
        this.connectionStatus$.next({ connected: false });
        this.attemptReconnection();
        throw error;
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  private async handleMessage(message: any): Promise<void> {
    // Handle responses (messages with IDs)
    if (message.id !== undefined) {
      this.responses$.next(message as QsysResponse);
      return;
    }

    // Handle EngineStatus notifications
    switch (message.method) {
      case 'EngineStatus':
        const engineStatus = message.params as QsysEngineStatus;
        const designCode = engineStatus.DesignCode;

        // Check if this is a new design code
        const isNewDesign = this.designCode !== undefined && this.designCode !== designCode;

        if (this.designCode !== designCode) {
          this.designCode = designCode;
          this._components = {};
          await this.getAllComponents();
        }
        Object.values(this._components).forEach(async (component) => {
          await component.subscribe();
        });
        await this.changeGroupAutoPoll(AUTO_POLL_DEFAULT_ID, 1);

        if (!this._isConnected) {
          // Now we can mark the connection as fully established
          this._isConnected = true;
          this.connectionStatus$.next({
            connected: true,
            engineStatus,
            newDesign: isNewDesign
          });
        }
        this.engineStatus$.next(engineStatus);

        console.log('Engine status updated:', engineStatus);
        break;

      case 'ChangeGroup.Poll':
        let data = { changeGroupId: message.params.Id, changes: message.params.Changes };
        if (data.changes.length > 0) {
          this.changeGroupUpdates$.next(data);
        }
        break;

      default:
        console.warn('Unhandled message method:', message.method);
        break;
    }
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
    // First check if reconnection is explicitly disabled
    if (!this.reconnecting) {
      this.connectionStatus$.next({ connected: false, noReconnect: true });
      console.log('Reconnection disabled, not attempting to reconnect');
      return;
    }

    // Then check max attempts
    if (this.maxReconnectionAttempts > 0 && this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      this.connectionStatus$.next({ connected: false, noReconnect: true });
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectionAttempts++;
    const delay = this.reconnectionDelay * Math.pow(1.5, this.reconnectionAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectionAttempts})`);

    timer(delay)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.reconnecting && !this.connectionStatus$.value.connected) {
          this.setupSocketConnection();
        }
      });
  }

  /**
   * Get a list of all components in the current design
   * @returns Promise with array of component information
   */
  public async getComponents(withControls: boolean = false): Promise<QsysComponentData[]> {
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
  public async getControls(componentName: string): Promise<QsysControlData[]> {
    const response = await this.sendCommandAsync('Component.GetControls', { Name: componentName });
    return response.Controls.sort((a: { Name: string; }, b: { Name: string; }) => collator.compare(a.Name, b.Name));
  }

  /**
   * Set the value of a control
   * @param componentName The name of the component
   * @param controlName The name of the control
   * @param value The new value for the control
   * @param ramp Optional ramp time in seconds
   * @returns Promise with the response as a boolean indicating success
   */
  public async setComponentValue(componentName: string, controlName: string, value: any, ramp?: number): Promise<boolean> {
    const response = await this.sendCommandAsync('Component.Set', {
      Name: componentName, Controls: [{
        Name: controlName,
        Value: value,
        Ramp: ramp ?? 0
      }]
    });
    return response;
  }

  /**
   * Set the position of a control
   * @param componentName The name of the component
   * @param controlName The name of the control
   * @param position The new position for the control (value between 0-1)
   * @param ramp Optional ramp time in seconds
   * @returns Promise with the response as a boolean indicating success
   */
  public async setComponentPosition(componentName: string, controlName: string, position: number, ramp?: number): Promise<boolean> {
    const response = await this.sendCommandAsync('Component.Set', {
      Name: componentName, Controls: [{
        Name: controlName,
        Position: position,
        Ramp: ramp ?? 0
      }]
    });
    return response;
  }

  /**
   * Create a new change group
   * @param groupName The name of the change group
   * @param componentName The name of the component the controls belong to
   * @param controlNames The names of the controls to add to the change group
   * @returns Promise with the response as a boolean indicating success
   */
  public async changeGroupAddControls(groupName: string, componentName: string, controlNames: string[]): Promise<boolean> {
    const response = await this.sendCommandAsync('ChangeGroup.AddComponentControl', {
      Id: groupName,
      Component: {
        Name: componentName,
        Controls: controlNames.map(name => ({ Name: name }))
      }
    });
    return response;
  }

  _changeGroupPollInternal(groupName = AUTO_POLL_DEFAULT_ID) {
    clearTimeout(this.pollInternalTimeout);
    this.pollInternalTimeout = setTimeout(async () => {
      let response = await this.changeGroupPoll(groupName);
      this.changeGroupUpdates$.next(response);
    }, 50);
  }

  /**
   * Poll a change group for updates
   * @param groupName The name of the change group
   * @returns Promise with the response as an object with the change group ID and changes
   * (an array of QsysChangeData objects)
   */
  public async changeGroupPoll(groupName: string): Promise<{ changeGroupId: string, changes: QsysChangeData[] }> {
    const response = await this.sendCommandAsync('ChangeGroup.Poll', { Id: groupName });
    return { changeGroupId: response.Id, changes: response.Changes };
  }

  /**
   * Change the rate of polling for a change group
   * @param groupName the name of the change group
   * @param rate the rate of polling in seconds
   * @returns Promise with the response as a boolean indicating success
   */
  public async changeGroupAutoPoll(groupName: string, rate: number): Promise<boolean> {
    const response = await this.sendCommandAsync('ChangeGroup.AutoPoll', { Id: groupName, Rate: rate });
    return response;
  }

  /**
   * Get a list of all components in the current design
   * Using this method will cache the components for future use
   * The components will be returned as instances of the Component class
   * and can be subscribed to using change group control
   * @returns Promise with array of components @see QsysComponent
   */
  public async getAllComponents(): Promise<QsysComponent[]> {
    if (this._components && Object.keys(this._components).length > 0) {
      return Object.values(this._components);
    }
    const components = await this.getComponents(true);
    components.forEach(async (component) => {
      this._components[component.Name] = new QsysComponent(this, component);
    });
    return Object.values(this._components);
  }

  /**
   * Get a specific component by name
   * Using this method will cache the component for future use
   * @param componentName The name of the component
   * @returns Promise with the component
   */
  public async getComponent(componentName: string): Promise<QsysComponent | undefined> {
    if (!this._components[componentName]) {
      const components = await this.getComponents(false);
      let componentData = components.find((component) => component.Name === componentName);
      if (!componentData) {
        return undefined;
      }
      let controlsData = await this.getControls(componentName);
      componentData.Controls = controlsData;
      this._components[componentName] = new QsysComponent(this, componentData);
      return this._components[componentName];
    }
    return this._components[componentName];
  }

  /**
   * Get the current connection state
   */
  public get isConnected(): boolean {
    return this._isConnected;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
