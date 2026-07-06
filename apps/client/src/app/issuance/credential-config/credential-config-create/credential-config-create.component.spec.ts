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

  it('normalizes mDOC field paths to be relative in the form and stores namespace separately', () => {
    component.form.get('format')?.setValue('mso_mdoc');
    component.form.get('docType')?.setValue('eu.europa.ec.eudi.pid.1');

    const fieldGroup = component.createFieldGroup({
      path: ['eu.europa.ec.eudi.pid.1', 'given_name'],
      namespace: 'eu.europa.ec.eudi.pid.1',
      type: 'string',
      defaultValue: 'ERIKA',
    } as any);

    expect(fieldGroup.get('path')?.value).toBe('given_name');
    expect(fieldGroup.get('namespace')?.value).toBe('eu.europa.ec.eudi.pid.1');

    const payload = (component as any).buildFieldsPayload(
      [
        {
          path: 'given_name',
          namespace: 'eu.europa.ec.eudi.pid.1',
          type: 'string',
          defaultValue: '"ERIKA"',
          mandatory: true,
        },
      ],
      true
    );

    expect(payload).toEqual([
      {
        path: ['given_name'],
        namespace: 'eu.europa.ec.eudi.pid.1',
        type: 'string',
        mandatory: true,
        defaultValue: 'ERIKA',
      },
    ]);
  });

  it('does not split dotted mDOC claim names into nested path segments', () => {
    component.form.get('format')?.setValue('mso_mdoc');

    const payload = (component as any).buildFieldsPayload(
      [
        {
          path: 'org.iso.18013.5.1.given_name',
          namespace: 'eu.europa.ec.eudi.mdl.1',
          type: 'string',
        },
      ],
      true
    );

    expect(payload).toEqual([
      {
        path: ['org.iso.18013.5.1.given_name'],
        namespace: 'eu.europa.ec.eudi.mdl.1',
        type: 'string',
        mandatory: false,
      },
    ]);
  });

  it('does not auto-fill mDOC namespace from docType', () => {
    component.form.get('format')?.setValue('mso_mdoc');
    component.form.get('docType')?.setValue('eu.europa.ec.eudi.mdl.1');

    const fieldGroup = component.createFieldGroup({
      path: ['given_name'],
      type: 'string',
    } as any);

    expect(fieldGroup.get('namespace')?.value).toBe('');
  });
});
