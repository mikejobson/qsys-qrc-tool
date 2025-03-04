import { Routes } from '@angular/router';
import { ConnectComponent } from './connect/connect.component';
import { MainComponent } from './main/main.component';
import { setupGuard } from './setup.guard';
import { ConnectingComponent } from './connecting/connecting.component';
import { connectingGuard } from './connecting.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'main', pathMatch: 'full' },
    { path: 'main', component: MainComponent, canActivate: [setupGuard, connectingGuard] },
    { path: 'connect', component: ConnectComponent },
    { path: 'connecting', component: ConnectingComponent },
];
