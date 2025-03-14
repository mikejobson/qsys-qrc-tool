import { Routes } from '@angular/router';
import { ConnectComponent } from './connect/connect.component';
import { MainComponent } from './main/main.component';
import { setupGuard } from './setup.guard';
import { ConnectingComponent } from './connecting/connecting.component';
import { connectingGuard } from './connecting.guard';
import { EngineStatusComponent } from './main/engine-status/engine-status.component';
import { ComponentsComponent } from './main/components/components.component';
import { AllComponentsComponent } from './main/all-components/all-components.component';

export const routes: Routes = [
    { path: '', redirectTo: 'main', pathMatch: 'full' },
    {
        path: 'main', component: MainComponent, canActivate: [setupGuard, connectingGuard],
        children: [
            { path: '', redirectTo: 'status', pathMatch: 'full' },
            { path: 'status', component: EngineStatusComponent },
            { path: 'component-tree', component: ComponentsComponent },
            { path: 'components', component: AllComponentsComponent },
        ]
    },
    { path: 'connect', component: ConnectComponent },
    { path: 'connecting', component: ConnectingComponent },
];
