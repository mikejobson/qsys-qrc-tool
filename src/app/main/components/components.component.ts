import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, signal, type OnInit } from '@angular/core';
import { QsysComponent, QsysLibService } from 'qsys-lib';
import { BehaviorSubject, map, Observable, Subject, Subscription } from 'rxjs';
import { MatTreeModule } from '@angular/material/tree';
import { CollectionViewer, DataSource, SelectionChange } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSpinner, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { MatButtonModule } from '@angular/material/button';

export enum NodeType {
  Component,
  PropertiesGroup,
  Control,
  Property
}

export class DynamicFlatNode {
  constructor(
    public item: string,
    public level = 1,
    public expandable = false,
    public isLoading = signal(false),
    public component?: QsysComponent,
    public nodeType: NodeType = NodeType.Component,
    public data?: any // For storing properties or controls
  ) { }
}

export class DynamicDataSource implements DataSource<DynamicFlatNode> {
  private _dataChange = new BehaviorSubject<DynamicFlatNode[]>([]);
  private api: QsysLibService;
  private subscription?: Subscription; // Track subscription

  constructor(private treeControl: FlatTreeControl<DynamicFlatNode>, api: QsysLibService) {
    this.api = api;
  }

  get data(): DynamicFlatNode[] {
    return this._dataChange.value;
  }

  set data(value: DynamicFlatNode[]) {
    this._dataChange.next(value);
  }

  connect(collectionViewer: CollectionViewer): Observable<readonly DynamicFlatNode[]> {
    // Clean up any previous subscription to avoid duplicate handlers
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    // Create new subscription
    this.subscription = this.treeControl.expansionModel.changed
      .subscribe(change => {
        if (change.added || change.removed) {
          this.handleTreeControl(change);
        }
      });

    return this._dataChange;
  }

  disconnect(collectionViewer: CollectionViewer): void {
    // Clean up subscription when disconnected
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  handleTreeControl(change: SelectionChange<DynamicFlatNode>) {
    console.log('handleTreeControl', change);
    if (change.added) {
      change.added.forEach(node => this.toggleNode(node, true));
    }
    if (change.removed) {
      change.removed.slice().reverse().forEach(node => this.toggleNode(node, false));
    }
  }

  toggleNode(node: DynamicFlatNode, expand: boolean) {
    console.log('toggleNode', node, expand);
    const index = this.data.indexOf(node);
    if (index < 0) return;

    if (expand) {
      // Node is being expanded
      node.isLoading.set(true);

      // Handle different node types
      switch (node.nodeType) {
        case NodeType.Component:
          // Load controls for component
          if (node.component) {
            this.loadComponentControls(node, index);
          }
          break;

        case NodeType.PropertiesGroup:
          // Load properties for component
          this.loadComponentProperties(node, index);
          break;

        default:
          node.isLoading.set(false);
      }
    } else {
      // Node is being collapsed - remove all children
      let count = 0;
      for (let i = index + 1; i < this.data.length && this.data[i].level > node.level; i++, count++) { }
      this.data.splice(index + 1, count);
      this._dataChange.next(this.data);
    }
  }

  private async loadComponentControls(node: DynamicFlatNode, index: number) {
    try {
      if (!node.component) return;

      // Get controls for this component
      const controls = await this.api.getControls(node.component.Name);
      node.isLoading.set(false);

      const nodes: DynamicFlatNode[] = [];

      // Add Properties group node if component has properties
      if (node.component.Properties && node.component.Properties.length > 0) {
        const propertiesNode = new DynamicFlatNode(
          `Properties (${node.component.Properties.length})`,
          node.level + 1,
          true, // Expandable
          signal(false),
          node.component, // Pass component reference to properties group
          NodeType.PropertiesGroup
        );
        nodes.push(propertiesNode);
      }

      // Add control nodes
      if (controls && controls.length > 0) {
        controls.forEach(control => {
          const childNode = new DynamicFlatNode(
            `${control.Name}: ${control.Value}`,
            node.level + 1,
            false,
            signal(false),
            node.component, // Pass the parent component reference to each control node
            NodeType.Control,
            control
          );
          nodes.push(childNode);
        });
      }

      // Insert the new nodes after the parent
      this.data.splice(index + 1, 0, ...nodes);
      this._dataChange.next(this.data);
    } catch (error) {
      console.error('Error loading controls:', error);
      node.isLoading.set(false);
    }
  }

  // Add a new method to load properties
  private async loadComponentProperties(node: DynamicFlatNode, index: number) {
    try {
      if (!node.component || node.nodeType !== NodeType.PropertiesGroup) return;

      node.isLoading.set(false);
      const properties = node.component.Properties;

      const nodes: DynamicFlatNode[] = [];
      if (properties && properties.length > 0) {
        properties.forEach(property => {
          const childNode = new DynamicFlatNode(
            `${property.Name}: ${property.Value}`,
            node.level + 1,
            false,
            signal(false),
            node.component, // Pass the parent component reference
            NodeType.Property,
            property
          );
          nodes.push(childNode);
        });
      }

      // Insert the new nodes after the parent
      this.data.splice(index + 1, 0, ...nodes);
      this._dataChange.next(this.data);
    } catch (error) {
      console.error('Error loading properties:', error);
      node.isLoading.set(false);
    }
  }

  initializeWithComponents(components: QsysComponent[]) {
    // First clear any existing data
    this._dataChange.next([]);

    // Convert components to flat nodes
    const data = components.map(component => {
      return new DynamicFlatNode(
        component.Name,
        0,
        true, // All components are expandable
        signal(false),
        component,
        NodeType.Component
      );
    });

    // Sort alphabetically
    data.sort((a, b) => a.item.localeCompare(b.item));

    this.data = data;
  }

}

@Component({
  selector: 'app-components',
  imports: [
    CommonModule,
    MatTreeModule,
    FontAwesomeModule,
    MatButtonModule
  ],
  templateUrl: './components.component.html',
  styleUrl: './components.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComponentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private api = inject(QsysLibService);
  private cd = inject(ChangeDetectorRef);
  components: QsysComponent[] = [];
  faSpinner = faSpinner;
  faCaretRight = faCaretRight;
  faCaretDown = faCaretDown;
  NodeType = NodeType; // Make enum available in template
  loading = false;

  treeControl = new FlatTreeControl<DynamicFlatNode>(
    node => node.level,
    node => node.expandable
  );

  dataSource: DynamicDataSource;
  selectedControl: any;

  constructor() {
    this.dataSource = new DynamicDataSource(this.treeControl, this.api);
  }

  ngOnInit(): void {
    this.updateComponents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasChild = (_: number, node: DynamicFlatNode) => node.expandable;

  getNodeClass(node: DynamicFlatNode): string {
    switch (node.nodeType) {
      case NodeType.Component:
        return 'node-component';
      case NodeType.PropertiesGroup:
        return 'node-properties-group';
      case NodeType.Control:
        return 'node-control';
      case NodeType.Property:
        return 'node-property';
      default:
        return '';
    }
  }

  async updateComponents() {
    try {
      this.loading = true;
      this.components = await this.api.getComponents();
      console.log(this.components);
      this.dataSource.initializeWithComponents(this.components);
    } catch (error) {
      console.error('Error loading components:', error);
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }
  }

  selectControl(node: DynamicFlatNode) {
    if (node.nodeType === NodeType.Control) {
      console.log('Selected control:', node.data);
      this.selectedControl = { component: node.component?.Name, ...node.data };
    }
  }

}
