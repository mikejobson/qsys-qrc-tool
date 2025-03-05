import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, type OnInit } from '@angular/core';
import { AUTO_POLL_DEFAULT_ID, QsysControl, QsysComponent, QsysLibService } from 'qsys-lib';
import { Subject } from 'rxjs';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-all-components',
  imports: [
    CommonModule,
    MatExpansionModule,
    MatButtonModule,
    MatTableModule,
    MatDividerModule,
    FontAwesomeModule,
    MatSlideToggleModule,
    MatSliderModule
  ],
  templateUrl: './all-components.component.html',
  styleUrl: './all-components.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllComponentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private api = inject(QsysLibService);
  private cd = inject(ChangeDetectorRef);
  components: QsysComponent[] = [];
  displayedPropertyColumns: string[] = ['PrettyName', 'Name', 'Value'];
  displayedControlColumns: string[] = ['name', 'type', 'value', 'string', 'stringMin', 'stringMax', 'canWrite'];
  faSpinner = faSpinner;
  loading = true;

  ngOnInit(): void {
    this.getComponents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async getComponents(): Promise<void> {
    this.components = await this.api.getAllComponents();
    this.components.forEach(async (component) => {
      component.updated.subscribe((controls: QsysControl[]) => {
        this.cd.detectChanges();
      });
    });
    this.loading = false;
    this.cd.markForCheck();
  }

  async onToggleChange(change: MatSlideToggleChange, control: QsysControl) {
    console.log(`Toggling ${control.name} to ${change.checked}`);
    await control.setValue(change.checked);
    this.cd.detectChanges();
  }
}
