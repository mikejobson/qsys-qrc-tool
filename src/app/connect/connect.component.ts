import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormsModule, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { QsysLibService } from 'qsys-lib';
import { Router } from '@angular/router';

@Component({
  selector: 'app-connect',
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule
  ],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectComponent implements OnInit {
  readonly api: QsysLibService = inject(QsysLibService);
  readonly ipAddress = new FormControl('', { validators: [Validators.required] });
  readonly router = inject(Router);

  ngOnInit(): void {
    this.ipAddress.setValue(this.api.coreAddress!);
  }

  connect() {
    localStorage.setItem('coreAddress', this.ipAddress.value!);
    console.log('Connecting to', this.ipAddress.value);
    this.api.connect(this.ipAddress.value!);
    this.router.navigate(['/connecting']);
  }
}
