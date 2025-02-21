import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { LkComponent } from './components/lk/lk.component';
import { AuthGuard } from './auth.guard';
import { RegistrationComponent } from './components/registration/registration.component';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';


const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegistrationComponent},
  { path: 'login', component: LoginComponent },
  {
    path: 'lk', component: LkComponent, canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [{ provide: LocationStrategy, useClass: HashLocationStrategy }]
})
export class AppRoutingModule { }
