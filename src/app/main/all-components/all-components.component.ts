import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, type OnInit } from '@angular/core';
import { QsysControl, QsysComponent, QsysLibService } from 'qsys-lib';
import { Subject, debounceTime } from 'rxjs';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-all-components',
  imports: [
    CommonModule,
    MatExpansionModule,
    MatButtonModule,
    MatTableModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './all-components.component.html',
  styleUrl: './all-components.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AllComponentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private api = inject(QsysLibService);
  private cd = inject(ChangeDetectorRef);

  // Debouncing for slider position updates
  private positionUpdate$ = new Subject<{ position: number, control: QsysControl }>();
  private valueUpdate$ = new Subject<{ value: number, control: QsysControl }>();

  components: QsysComponent[] = [];
  displayedPropertyColumns: string[] = ['PrettyName', 'Name', 'Value'];
  displayedControlColumns: string[] = ['name', 'type', 'value', 'string', 'stringMin', 'stringMax', 'canWrite'];
  loading = true;

  ngOnInit(): void {
    this.getComponents();

    // Setup debouncing for slider updates to avoid overwhelming the QSys Core
    this.positionUpdate$.pipe(
      debounceTime(50), // Send updates at most every 50ms while sliding
    ).subscribe(data => {
      this.performPositionUpdate(data.position, data.control);
    });

    this.valueUpdate$.pipe(
      debounceTime(50), // Send updates at most every 50ms while sliding
    ).subscribe(data => {
      this.performValueUpdate(data.value, data.control);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async getComponents(): Promise<void> {
    this.components = await this.api.getAllComponents();
    this.components.forEach(async (component) => {
      component.updated.subscribe((controls: QsysControl[]) => {
        // controls.forEach((control) => {
        //   console.log(`Control ${control.name} updated`);
        // });
        this.cd.detectChanges();
      });
    });
    this.loading = false;
    this.cd.markForCheck();
  }

  async onToggleChange(change: MatSlideToggleChange, control: QsysControl) {
    await control.setValue(change.checked);
    this.cd.detectChanges();
  }

  // New unified input handler to handle the event safely
  onSliderInput(event: Event, control: QsysControl, type: 'value' | 'position'): void {
    // Safely extract the value from the event
    const inputElement = event.target as HTMLInputElement;
    if (inputElement && inputElement.value !== undefined) {
      const numValue = Number(inputElement.value);

      if (type === 'position') {
        this.positionUpdate$.next({ position: numValue, control });
      } else {
        this.valueUpdate$.next({ value: numValue, control });
      }

      // Update UI immediately for responsive feel
      this.cd.detectChanges();
    }
  }

  // Use this for collecting slider value events while sliding
  onSliderChangeValue(value: number, control: QsysControl) {
    this.valueUpdate$.next({ value, control });
    // Update UI immediately for responsive feel
    this.cd.detectChanges();
  }

  // Use this for collecting slider position events while sliding
  onSliderChangePosition(position: number, control: QsysControl) {
    this.positionUpdate$.next({ position, control });
    // Update UI immediately for responsive feel
    this.cd.detectChanges();
  }

  // Actually perform the position update (debounced)
  private async performPositionUpdate(position: number, control: QsysControl) {
    await control.setPosition(position);
    this.cd.detectChanges();
  }

  // Actually perform the value update (debounced)
  private async performValueUpdate(value: number, control: QsysControl) {
    await control.setValue(value);
    this.cd.detectChanges();
  }

  async onTriggerClick(control: QsysControl) {
    console.log(`Triggering ${control.name}`);
    await control.trigger();
    this.cd.detectChanges();
  }

  async onValueEditChange(event: any, control: QsysControl) {
    console.log(`Setting ${control.name} to ${event.target.value}`);
    await control.setValue(event.target.value);
    this.cd.detectChanges();
  }
}
