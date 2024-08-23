import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RemotesPage } from './remotes.page';

describe('RemotesPage', () => {
  let component: RemotesPage;
  let fixture: ComponentFixture<RemotesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RemotesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
