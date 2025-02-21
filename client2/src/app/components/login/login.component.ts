import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { LoginService } from '../../services/login.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: UntypedFormGroup;
  error: any;


  constructor(private fb: UntypedFormBuilder, private loginService: LoginService, private router: Router) {
    this.loginForm = this.fb.group({
      login: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const formData = {
        username: this.loginForm.value.login,
        password: this.loginForm.value.password
      };
      this.loginService.loginUser(formData).subscribe(
        (response: any) => {
          console.log('Юзер успешно залогинился', response);
          
          this.router.navigate(['/lk']);
        },
        (error: any) => {
          console.error('Произошла ошибка во время авторизации', error);
          this.error = `Произошла ошибка во время авторизации ${error}`;
        }
      );
    }
  }

}
