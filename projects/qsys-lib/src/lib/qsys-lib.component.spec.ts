import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QsysLibComponent } from './qsys-lib.component';

describe('QsysLibComponent', () => {
  let component: QsysLibComponent;
  let fixture: ComponentFixture<QsysLibComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QsysLibComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QsysLibComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
