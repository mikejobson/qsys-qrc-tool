import { TestBed } from '@angular/core/testing';

import { QsysLibService } from './qsys-lib.service';

describe('QsysLibService', () => {
  let service: QsysLibService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QsysLibService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
