import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, signal, type OnInit } from '@angular/core';
import { QsysComponent, QsysLibService } from 'qsys-lib';
import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { MatTreeModule } from '@angular/material/tree';
import { CollectionViewer, DataSource, SelectionChange } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSpinner, faCaretRight, faCaretDown } from '@fortawesome/free-solid-svg-icons';
import { MatButtonModule } from '@angular/material/button';

export class DynamicFlatNode {
  constructor(
    public item: string,
    public level = 1,
    public expandable = false,
    public isLoading = signal(false),
    public component?: QsysComponent,
  ) { }
}

export class DynamicDataSource implements DataSource<DynamicFlatNode> {
  private _dataChange = new BehaviorSubject<DynamicFlatNode[]>([]);
  private api: QsysLibService;

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
    this.treeControl.expansionModel.changed
      .subscribe(change => {
        if (change.added || change.removed) {
          this.handleTreeControl(change);
        }
      });
    return this._dataChange;
  }
  disconnect(collectionViewer: CollectionViewer): void {
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
      // Node is being expanded - load its child controls
      node.isLoading.set(true);
      // For component nodes, load controls
      if (node.component) {
        this.loadComponentControls(node, index);
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

      // Create child nodes for controls
      const nodes: DynamicFlatNode[] = [];
      if (controls && controls.length > 0) {
        controls.forEach(control => {
          const childNode = new DynamicFlatNode(
            `${control.Name}: ${control.Value}`,
            node.level + 1,
            false,
            signal(false)
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

  initializeWithComponents(components: QsysComponent[]) {
    // Convert components to flat nodes
    const data = components.map(component => {
      return new DynamicFlatNode(
        component.Name,
        0,
        true, // All components are expandable
        signal(false),
        component
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

  treeControl = new FlatTreeControl<DynamicFlatNode>(
    node => node.level,
    node => node.expandable
  );

  dataSource: DynamicDataSource;

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

  async updateComponents() {
    this.components = await this.api.getComponents(false);
    console.log(this.components);
    this.dataSource.initializeWithComponents(this.components);
    this.cd.markForCheck();
  }

}
