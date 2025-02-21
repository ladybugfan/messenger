import { Component } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RegistrationService } from '../../services/registration.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss']
})
export class RegistrationComponent {
  registrationForm: UntypedFormGroup;
  hide = true;
  today = new Date().toISOString().split('T')[0];
  hideConfirm = true;
  matchPasswordValidator: any;
  registrationSuccess: boolean = false;
  registrationError: string = '';


  constructor(private fb: UntypedFormBuilder, private registrationService: RegistrationService) {
    this.registrationForm = this.fb.group({
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/), Validators.maxLength(50)]], //+
      password: [
        '',
        [Validators.required, Validators.minLength(9), Validators.maxLength(30),
        Validators.pattern(/^(?=.*[A-Z])(?=.*[\W_])(?=.*[a-z])[A-Za-z\d\W_]+$/)],
      ],
      confirmPassword: ['', [Validators.required, this.passwordMatchValidator]],
    }
    );
  }

  /* minimumAgeValidator(minAge: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const inputDate = new Date(control.value);
      const today = new Date();
      const age = today.getFullYear() - inputDate.getFullYear();
      const monthDifference = today.getMonth() - inputDate.getMonth();
      const dayDifference = today.getDate() - inputDate.getDate();

      const isOldEnough =
        age > minAge ||
        (age === minAge && (monthDifference > 0 || (monthDifference === 0 && dayDifference >= 0)));

      return isOldEnough ? null : { tooYoung: true };
    }
  } */

  passwordMatchValidator(formGroup: UntypedFormGroup) {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else {
      confirmPassword?.setErrors(null);
    }
    return null;
  }

  onSubmit() {
    if (this.registrationForm.valid) {
      const formData = {
        username: this.registrationForm.value.username.toLowerCase(),
        password: this.registrationForm.value.password
      };
      this.registrationService.registerUser(formData).subscribe(
        (response: any) => {
          this.registrationSuccess = true;
          this.registrationError = '';
          console.log('Пользователь успешно зарегистрирован', response);
        },
        (error: any) => {
          console.error('Произошла ошибка регистрации', error);
          if (error.status === 400 && error.error.error === 'User already exists') {
            this.registrationError = 'Пользователь с таким именем уже зарегистрирован.';
          } else {
            this.registrationError = 'Произошла ошибка регистрации. Попробуйте снова.';
          }
          this.registrationSuccess = false;
        }
      );
    }
  }
}