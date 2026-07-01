import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { IssuanceOfferComponent } from './issuance-offer.component';
import { AttributeProviderService } from '../attribute-provider/attribute-provider.service';
import { CredentialConfigService } from '../credential-config/credential-config.service';
import { IssuanceConfigService } from '../issuance-config/issuance-config.service';

function buildMdocConfig() {
  return {
    id: 'pid',
    config: {
      format: 'mso_mdoc',
      docType: 'eu.europa.ec.eudi.pid.1',
    },
    fields: [
      {
        path: ['eu.europa.ec.eudi.pid.1', 'given_name'],
        type: 'string',
        mandatory: true,
        defaultValue: 'Ada',
      },
      {
        path: ['eu.europa.ec.eudi.pid.1', 'family_name'],
        type: 'string',
        mandatory: true,
      },
    ],
  };
}

describe('IssuanceOfferComponent', () => {
  let component: IssuanceOfferComponent;
  let fixture: ComponentFixture<IssuanceOfferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IssuanceOfferComponent],
      providers: [
        {
          provide: IssuanceConfigService,
          useValue: {
            getConfig: jasmine.createSpy().and.resolveTo(undefined),
            getOffer: jasmine.createSpy().and.resolveTo({ session: 'session-id', uri: 'uri' }),
          },
        },
        {
          provide: CredentialConfigService,
          useValue: {
            loadConfigurations: jasmine.createSpy().and.resolveTo([]),
          },
        },
        {
          provide: AttributeProviderService,
          useValue: {
            getAll: jasmine.createSpy().and.resolveTo([]),
          },
        },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy() } },
        { provide: Router, useValue: { navigate: jasmine.createSpy().and.resolveTo(true) } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IssuanceOfferComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders mdoc fields without the namespace wrapper and wraps them on submit', async () => {
    const config = buildMdocConfig() as any;
    component.credentialConfigs = [config];

    await component.setClaimFormFields(['pid']);

    expect(component.fields).toHaveSize(1);
    expect(component.fields[0].fieldGroup?.some((field) => field.key === 'given_name')).toBeTrue();
    expect(
      component.fields[0].fieldGroup?.some((field) => field.key === 'eu.europa.ec.eudi.pid.1')
    ).toBeFalse();

    expect(component.elements[0].defaultClaims).toEqual({ given_name: 'Ada' });

    component.flowStepForm.patchValue({ flow: 'pre_authorized_code' });
    component.credentialStepForm.patchValue({ credentialConfigurationIds: ['pid'] });
    component.configStepForm.get('claims')?.patchValue({ pid: { given_name: 'Ada' } });
    component.elements[0].claimSource = 'form';

    await component.onSubmit();

    const issuanceConfigService = TestBed.inject(IssuanceConfigService) as any;
    const offerRequest = issuanceConfigService.getOffer.calls.mostRecent().args[0];

    expect(offerRequest.credentialClaims.pid.claims).toEqual({
      'eu.europa.ec.eudi.pid.1': { given_name: 'Ada' },
    });
  });
});
