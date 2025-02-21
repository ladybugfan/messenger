import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserChatsComponent } from './user-chats.component';

describe('UserChatsComponent', () => {
  let component: UserChatsComponent;
  let fixture: ComponentFixture<UserChatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserChatsComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserChatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
