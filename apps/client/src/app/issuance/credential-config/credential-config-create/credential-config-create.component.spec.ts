import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { CredentialConfigCreateComponent } from './credential-config-create.component';

describe('CredentialConfigCreateComponent', () => {
  let component: CredentialConfigCreateComponent;
  let fixture: ComponentFixture<CredentialConfigCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CredentialConfigCreateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CredentialConfigCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('normalizes mDOC field paths to be relative in the form and namespaced when saving', () => {
    component.form.get('format')?.setValue('mso_mdoc');
    component.form.get('docType')?.setValue('eu.europa.ec.eudi.pid.1');

    const fieldGroup = component.createFieldGroup({
      path: ['eu.europa.ec.eudi.pid.1', 'given_name'],
      type: 'string',
      defaultValue: 'ERIKA',
    } as any);

    expect(fieldGroup.get('path')?.value).toBe('given_name');

    const payload = (component as any).buildFieldsPayload(
      [
        {
          path: 'given_name',
          type: 'string',
          defaultValue: '"ERIKA"',
          mandatory: true,
        },
      ],
      true,
      'eu.europa.ec.eudi.pid.1'
    );

    expect(payload).toEqual([
      {
        path: ['eu.europa.ec.eudi.pid.1', 'given_name'],
        type: 'string',
        mandatory: true,
        defaultValue: 'ERIKA',
      },
    ]);
  });
});
