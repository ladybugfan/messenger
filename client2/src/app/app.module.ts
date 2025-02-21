import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { MaterialModule } from './material.module';
import { HttpClientModule } from '@angular/common/http';
import { LoginService } from './services/login.service';
import { LoginComponent } from './components/login/login.component';
import { CommonModule } from '@angular/common';
import { LkComponent } from './components/lk/lk.component';
import { OperationsService } from './services/operations.service';
import { CardService } from './services/card.service';
import { RegistrationService } from './services/registration.service';
import { ChatDialogComponent } from './components/chat-dialog/chat-dialog.component';
import { ChatService } from './services/chat.service';
import { UserChatsComponent } from './components/user-chats/user-chats.component';
import { SocketService } from './services/socket.service';
import { RegistrationComponent } from './components/registration/registration.component';


@NgModule({
  declarations: [
    AppComponent,
    RegistrationComponent,
    LoginComponent,
    LkComponent,
    ChatDialogComponent,
    UserChatsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MaterialModule,
    HttpClientModule,
    FormsModule,
    CommonModule
  ],
  providers: [RegistrationService, LoginService, OperationsService, CardService, ChatService, SocketService],
  bootstrap: [AppComponent],
})
export class AppModule { }

