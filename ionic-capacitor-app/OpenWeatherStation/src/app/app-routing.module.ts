import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  //home
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then(m => m.HomePageModule)
  },
  //devices
  {
    path: 'devices',
    loadChildren: () => import('./pages/devices/devices.module').then(m => m.DevicesPageModule)
  },
  //remotes
  {
    path: 'remotes',
    loadChildren: () => import('./pages/remotes/remotes.module').then(m => m.RemotesPageModule)
  },
  //settings
  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then(m => m.SettingsPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
