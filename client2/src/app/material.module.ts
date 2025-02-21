import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';  // Обновленный импорт
import { MatFormFieldModule } from '@angular/material/form-field';  // Обновленный импорт
import { MatInputModule } from '@angular/material/input';  // Обновленный импорт
import { MatDatepickerModule } from '@angular/material/datepicker';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';  // Обновленный импорт
import { MatSelectModule } from '@angular/material/select';  // Обновленный импорт
import { HttpClientModule } from '@angular/common/http';
import { MatMenuModule } from '@angular/material/menu';  // Обновленный импорт
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';  // Обновленный импорт
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';  // Обновленный импорт
import { MatCardModule } from '@angular/material/card';  // Обновленный импорт
import { MatDialogModule } from '@angular/material/dialog';  // Обновленный импорт
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';  // Обновленный импорт
import { MatAutocompleteModule } from '@angular/material/autocomplete';  // Обновленный импорт
import { MatTableModule } from '@angular/material/table';  // Обновленный импорт
import { MatListModule } from '@angular/material/list';  // Обновленный импорт


@NgModule({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    BrowserAnimationsModule,
    MatNativeDateModule,
    MatRadioModule,
    MatSelectModule,
    HttpClientModule,
    MatMenuModule,
    MatIconModule,
    MatTooltipModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTableModule,
    MatListModule
  ],
  exports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    BrowserAnimationsModule,
    MatNativeDateModule,
    MatRadioModule,
    MatSelectModule,
    HttpClientModule,
    MatMenuModule,
    MatIconModule,
    MatTooltipModule,
    MatToolbarModule,
    MatTabsModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTableModule,
    MatListModule
  ],
})
export class MaterialModule { }
